import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const API_URL = ((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL) || 'http://localhost:4000';
const TOKEN_KEY = 'lesio.auth.token';
const AGENT_THREADS_KEY = 'lesio.agent.threads';
const AGENT_ACTIVE_THREAD_KEY = 'lesio.agent.activeThreadId';
const MAX_AGENT_ITERATIONS = 5;
const MAX_CONTEXT_MESSAGES = 24;
const MAX_CONTEXT_CHARS = 24000;

type ToolSpec = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

type StoredAgentMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<Record<string, unknown>>;
  tool_call_id?: string;
};

type AgentThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredAgentMessage[];
  preview: string;
};

type ToolCallArgs = Record<string, any>;

function truncateText(value: unknown, maxLen = 1200): string {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function compactRecentScansPayload(payload: any, limit = 5) {
  const scans = Array.isArray(payload?.scans)
    ? payload.scans
    : Array.isArray(payload?.data?.scans)
      ? payload.data.scans
      : [];

  const compactScans = scans.slice(0, Math.max(1, limit)).map((scan: any) => ({
    id: scan?._id || scan?.id,
    date: scan?.createdAt || scan?.date || scan?.updatedAt || null,
    riskLevel: scan?.riskLevel || null,
    confidence: scan?.confidence ?? null,
    lesionType: scan?.lesionType || null,
    location: scan?.location || null,
  }));

  return {
    scanCount: scans.length,
    scans: compactScans,
  };
}

function compactScanDetailPayload(payload: any) {
  const scan = payload?.scan || payload?.data?.scan || payload?.data || payload;
  if (!scan || typeof scan !== 'object') {
    return payload;
  }

  return {
    id: scan?._id || scan?.id,
    date: scan?.createdAt || scan?.date || scan?.updatedAt || null,
    riskLevel: scan?.riskLevel || null,
    confidence: scan?.confidence ?? null,
    lesionType: scan?.lesionType || null,
    location: scan?.location || null,
    notes: truncateText(scan?.notes, 300),
    doctorNotes: truncateText(scan?.doctorNotes, 300),
    analysis: scan?.analysis
      ? {
          summary: truncateText(scan.analysis?.summary || '', 400),
          recommendations: Array.isArray(scan.analysis?.recommendations)
            ? scan.analysis.recommendations.slice(0, 5).map((item: any) => truncateText(item, 140))
            : undefined,
        }
      : undefined,
  };
}

function buildContextWindow(history: Array<Record<string, unknown>>) {
  const systemMessage = history.find((message) => message.role === 'system') || null;
  const nonSystem = history.filter((message) => message.role !== 'system');
  const selected: Array<Record<string, unknown>> = [];
  let usedChars = 0;

  for (let i = nonSystem.length - 1; i >= 0; i -= 1) {
    const message = nonSystem[i];
    const approxSize = JSON.stringify(message || {}).length;

    if (selected.length >= MAX_CONTEXT_MESSAGES - 1) break;
    if (usedChars + approxSize > MAX_CONTEXT_CHARS) break;

    selected.push(message);
    usedChars += approxSize;
  }

  selected.reverse();
  return systemMessage ? [systemMessage, ...selected] : selected;
}

type AgentHookResult = {
  chatMessages: ChatMessage[];
  isThinking: boolean;
  error: string | null;
  threads: AgentThread[];
  activeThreadId: string;
  sendMessage: (text: string) => void;
  clearChat: () => void;
  createNewThread: () => Promise<string>;
  selectThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
};

export function usePatientAgent(systemPrompt: string, tools: ToolSpec[] = []): AgentHookResult {
  const navigation = useNavigation<any>();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');

  const conversationHistoryRef = useRef<Array<Record<string, unknown>>>([
    { role: 'system', content: systemPrompt },
  ]);

  const makeThreadTitle = useCallback((messages: StoredAgentMessage[]) => {
    const firstUserMessage = messages.find((message) => message.role === 'user' && String(message.content || '').trim());
    const text = String(firstUserMessage?.content || '').trim();
    if (!text) return 'New conversation';
    return text.length > 32 ? `${text.slice(0, 32).trim()}...` : text;
  }, []);

  const serializeConversation = useCallback((history: Array<Record<string, unknown>>) => {
    return history
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role as 'user' | 'assistant' | 'tool',
        content: String(message.content || ''),
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
        tool_call_id: typeof message.tool_call_id === 'string' ? message.tool_call_id : undefined,
      }));
  }, []);

  const persistThreads = useCallback(async (nextThreads: AgentThread[], nextActiveThreadId: string) => {
    setThreads(nextThreads);
    setActiveThreadId(nextActiveThreadId);
    await AsyncStorage.multiSet([
      [AGENT_THREADS_KEY, JSON.stringify(nextThreads)],
      [AGENT_ACTIVE_THREAD_KEY, nextActiveThreadId],
    ]);
  }, []);

  const syncActiveThread = useCallback(async (history: Array<Record<string, unknown>>) => {
    const now = new Date().toISOString();
    const previewMessage = history.find((message) => message.role === 'user' && String(message.content || '').trim())
      || history.find((message) => message.role === 'assistant' && String(message.content || '').trim());

    const serializedMessages = serializeConversation(history);
    const title = makeThreadTitle(serializedMessages as StoredAgentMessage[]);
    const preview = String(previewMessage?.content || '').trim();

    const nextThread: AgentThread = {
      id: activeThreadId || `${Date.now()}`,
      title,
      createdAt: threads.find((thread) => thread.id === activeThreadId)?.createdAt || now,
      updatedAt: now,
      messages: [
        { role: 'system', content: systemPrompt },
        ...serializedMessages,
      ],
      preview: preview || 'Start a conversation',
    };

    const filtered = threads.filter((thread) => thread.id !== nextThread.id);
    await persistThreads([nextThread, ...filtered], nextThread.id);
    return nextThread.id;
  }, [activeThreadId, makeThreadTitle, persistThreads, serializeConversation, systemPrompt, threads]);

  const loadThreadIntoMemory = useCallback((thread?: AgentThread | null) => {
    const nextHistory = [
      { role: 'system', content: systemPrompt },
      ...((thread?.messages || []).filter((message) => message.role !== 'system')),
    ];

    conversationHistoryRef.current = nextHistory;
    setChatMessages((thread?.messages || [])
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message, index) => ({
        id: `${message.role}-${thread?.id || 'thread'}-${index}`,
        role: message.role as 'user' | 'assistant',
        text: String(message.content || ''),
        timestamp: new Date(thread?.updatedAt || Date.now()),
      })));
    setError(null);
  }, [systemPrompt]);

  useEffect(() => {
    let mounted = true;

    const hydrateThreads = async () => {
      try {
        const [storedThreads, storedActiveThreadId] = await AsyncStorage.multiGet([AGENT_THREADS_KEY, AGENT_ACTIVE_THREAD_KEY]);
        const parsedThreads = storedThreads?.[1] ? JSON.parse(storedThreads[1]) : [];
        const normalizedThreads: AgentThread[] = Array.isArray(parsedThreads) ? parsedThreads : [];
        const selectedThreadId = storedActiveThreadId?.[1] || normalizedThreads[0]?.id || '';
        const selectedThread = normalizedThreads.find((thread) => thread.id === selectedThreadId) || normalizedThreads[0] || null;

        if (!mounted) return;

        setThreads(normalizedThreads);
        setActiveThreadId(selectedThread?.id || '');
        if (selectedThread) {
          loadThreadIntoMemory(selectedThread);
        } else {
          const initialThreadId = `${Date.now()}`;
          const initialThread: AgentThread = {
            id: initialThreadId,
            title: 'New conversation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [{ role: 'system', content: systemPrompt }],
            preview: 'Start a conversation',
          };
          setThreads([initialThread]);
          setActiveThreadId(initialThreadId);
          conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
        }
      } catch (_error) {
        if (!mounted) return;
        const initialThreadId = `${Date.now()}`;
        setThreads([{
          id: initialThreadId,
          title: 'New conversation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [{ role: 'system', content: systemPrompt }],
          preview: 'Start a conversation',
        }]);
        setActiveThreadId(initialThreadId);
      }
    };

    void hydrateThreads();

    return () => {
      mounted = false;
    };
  }, [loadThreadIntoMemory, systemPrompt]);

  const appendMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    const message: ChatMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      text,
      timestamp: new Date(),
    };

    setChatMessages((previous) => [...previous, message]);
    return message;
  }, []);

  const handleToolCall = useCallback(async (name: string, args: ToolCallArgs) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    switch (name) {
      case 'query_patient_data': {
        const dataType = String(args?.dataType || '').trim();
        const limit = Number.isFinite(Number(args?.limit)) ? Number(args.limit) : 5;
        const endpointMap: Record<string, string> = {
          recent_scans: '/api/scans',
          appointments: '/api/bookings/me/appointments',
          notifications: '/api/patients/me/activity-overview',
          profile: '/api/patients/me/summary',
          activity: '/api/patients/me/activity',
        };

        const endpoint = endpointMap[dataType];
        if (!endpoint) {
          return JSON.stringify({ error: `Unsupported data type: ${dataType}` });
        }

        const url = new URL(`${API_URL}${endpoint}`);
        if (dataType === 'recent_scans' || dataType === 'activity') {
          url.searchParams.set('limit', String(limit));
        }

        const response = await fetch(url.toString(), { headers });
        const payload = await response.json().catch(() => null);

        if (dataType === 'recent_scans') {
          const compact = compactRecentScansPayload(payload, limit);
          return JSON.stringify({ ok: response.ok, status: response.status, data: compact });
        }

        return JSON.stringify({ ok: response.ok, status: response.status, data: payload });
      }

      case 'get_scan_detail': {
        const scanId = String(args?.scanId || '').trim();
        if (!scanId) {
          return JSON.stringify({ error: 'scanId is required' });
        }

        const response = await fetch(`${API_URL}/api/scans/${scanId}`, { headers });
        const payload = await response.json().catch(() => null);
        const compact = compactScanDetailPayload(payload);
        return JSON.stringify({ ok: response.ok, status: response.status, data: compact });
      }

      case 'navigate_to_screen': {
        const screen = String(args?.screen || '').trim();
        const params = args?.params || {};
        const routeMap: Record<string, string> = {
          Scans: 'PatientScans',
          ScanDetail: 'AIResult',
          ScanCapture: 'LesionScan',
          LesionTracking: 'LesionTracking',
          Appointments: 'PatientAppointmentsActivity',
          DermatologistFinder: 'DermatologistFinder',
          Notifications: 'Notifications',
          Activity: 'PatientActivity',
        };

        const routeName = routeMap[screen];
        if (!routeName) {
          return JSON.stringify({ error: `Unsupported screen: ${screen}` });
        }

        navigation.navigate(routeName as never, params as never);
        return JSON.stringify({ ok: true, routeName });
      }

      case 'get_recent_scans': {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const headersWithAuth: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await fetch(`${API_URL}/api/scans`, { headers: headersWithAuth });
        const payload = await response.json().catch(() => null);
        const compact = compactRecentScansPayload(payload, 5);
        return JSON.stringify({ ok: response.ok, status: response.status, data: compact });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }, [navigation]);

  const runAgentLoop = useCallback(async (userMessage: string) => {
    const trimmed = String(userMessage || '').trim();
    if (!trimmed) return;

    conversationHistoryRef.current.push({ role: 'user', content: trimmed });
    appendMessage('user', trimmed);
    setIsThinking(true);
    setError(null);

    try {
      for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const llmMessages = buildContextWindow(conversationHistoryRef.current);
        const response = await fetch(`${API_URL}/api/agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: llmMessages,
            tools,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in again to use the agent.');
          }
          throw new Error(payload?.error || `Agent request failed with status ${response.status}`);
        }

        const choice = payload?.choices?.[0];
        const message = choice?.message;
        if (!choice || !message) {
          throw new Error('Invalid agent response');
        }

        if (choice.finish_reason === 'tool_calls' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          conversationHistoryRef.current.push({
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls,
          });

          for (const toolCall of message.tool_calls) {
            let parsedArgs: ToolCallArgs = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch (_error) {
              parsedArgs = {};
            }

            const toolResult = await handleToolCall(toolCall.function.name, parsedArgs);
            conversationHistoryRef.current.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }

          continue;
        }

        const assistantText = String(message.content || '').trim();
        conversationHistoryRef.current.push({ role: 'assistant', content: assistantText });

        if (assistantText) {
          appendMessage('assistant', assistantText);
        }

        if (!assistantText && choice.finish_reason === 'stop') {
          appendMessage('assistant', 'I could not generate a response. Please try again.');
        }

        await syncActiveThread(conversationHistoryRef.current);
        break;
      }
    } catch (loopError: any) {
      setError(loopError?.message || 'Something went wrong');
      appendMessage('assistant', 'Sorry, something went wrong while handling your request.');
    } finally {
      setIsThinking(false);
    }
  }, [appendMessage, handleToolCall, syncActiveThread, tools]);

  const sendMessage = useCallback((text: string) => {
    void runAgentLoop(text);
  }, [runAgentLoop]);

  const clearChat = useCallback(() => {
    conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
    setChatMessages([]);
    setIsThinking(false);
    setError(null);
  }, [systemPrompt]);

  const createNewThread = useCallback(async () => {
    const now = new Date().toISOString();
    const newThreadId = `${Date.now()}`;
    const newThread: AgentThread = {
      id: newThreadId,
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      messages: [{ role: 'system', content: systemPrompt }],
      preview: 'Start a conversation',
    };

    await persistThreads([newThread, ...threads], newThreadId);
    loadThreadIntoMemory(newThread);
    return newThreadId;
  }, [loadThreadIntoMemory, persistThreads, systemPrompt, threads]);

  const selectThread = useCallback(async (threadId: string) => {
    const selected = threads.find((thread) => thread.id === threadId) || null;
    if (!selected) return;
    await AsyncStorage.setItem(AGENT_ACTIVE_THREAD_KEY, threadId);
    setActiveThreadId(threadId);
    loadThreadIntoMemory(selected);
  }, [loadThreadIntoMemory, threads]);

  const deleteThread = useCallback(async (threadId: string) => {
    const filtered = threads.filter((thread) => thread.id !== threadId);
    const nextActive = filtered[0]?.id || '';
    await persistThreads(filtered, nextActive);
    if (threadId === activeThreadId) {
      if (filtered[0]) {
        loadThreadIntoMemory(filtered[0]);
      } else {
        await createNewThread();
      }
    }
  }, [activeThreadId, createNewThread, loadThreadIntoMemory, persistThreads, threads]);

  return useMemo(() => ({
    chatMessages,
    isThinking,
    error,
    threads,
    activeThreadId,
    sendMessage,
    clearChat,
    createNewThread,
    selectThread,
    deleteThread,
  }), [activeThreadId, chatMessages, clearChat, createNewThread, deleteThread, error, isThinking, selectThread, sendMessage, threads]);
}
