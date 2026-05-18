import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { request } from '../services/api';

const API_URL = ((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL) || 'http://localhost:4000';
const TOKEN_KEY = 'lesio.auth.token';
const LEGACY_AGENT_THREADS_KEY = 'lesio.agent.threads';
const LEGACY_AGENT_ACTIVE_THREAD_KEY = 'lesio.agent.activeThreadId';
const AGENT_CONVERSATIONS_ENDPOINT = '/api/agent/conversations';
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
  timestamp?: string;
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

function createDraftThreadId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStoredThread(thread: any): AgentThread | null {
  if (!thread) return null;

  const id = String(thread.id || thread.conversationId || thread._id || '').trim();
  if (!id) return null;

  return {
    id,
    title: String(thread.title || 'New conversation').trim() || 'New conversation',
    createdAt: thread.createdAt || new Date().toISOString(),
    updatedAt: thread.updatedAt || thread.lastMessageAt || new Date().toISOString(),
    preview: String(thread.preview || 'Start a conversation').trim() || 'Start a conversation',
    messages: Array.isArray(thread.messages)
      ? thread.messages.map((message: any) => ({
          role: ['user', 'assistant', 'tool'].includes(String(message?.role)) ? message.role : 'assistant',
          content: String(message?.content || ''),
          tool_calls: Array.isArray(message?.tool_calls) ? message.tool_calls : undefined,
          tool_call_id: typeof message?.tool_call_id === 'string' ? message.tool_call_id : undefined,
          timestamp: message?.timestamp || message?.createdAt || message?.updatedAt || thread.updatedAt,
        }))
      : [],
  };
}

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
  const activeThreadIdRef = useRef('');

  const updateActiveThreadId = useCallback((threadId: string) => {
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
  }, []);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

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

  const syncActiveThread = useCallback(async (history: Array<Record<string, unknown>>) => {
    const serializedMessages = serializeConversation(history);
    if (serializedMessages.length === 0) {
      return activeThreadIdRef.current || activeThreadId || '';
    }

    const currentThreadId = activeThreadIdRef.current || activeThreadId || createDraftThreadId();
    if (!activeThreadIdRef.current) {
      updateActiveThreadId(currentThreadId);
    }

    const previewMessage = history.find((message) => message.role === 'user' && String(message.content || '').trim())
      || history.find((message) => message.role === 'assistant' && String(message.content || '').trim());

    const payload = {
      conversationId: currentThreadId,
      title: makeThreadTitle(serializedMessages as StoredAgentMessage[]),
      preview: String(previewMessage?.content || '').trim() || 'Start a conversation',
      messages: serializedMessages,
    };

    const responsePayload = await request(AGENT_CONVERSATIONS_ENDPOINT, {
      method: 'POST',
      body: payload,
    });

    const savedThread = normalizeStoredThread(responsePayload?.conversation || responsePayload);
    if (!savedThread) {
      throw new Error('Invalid agent conversation response');
    }

    setThreads((previous) => [savedThread, ...previous.filter((thread) => thread.id !== savedThread.id)]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
    updateActiveThreadId(savedThread.id);
    return savedThread.id;
  }, [activeThreadId, makeThreadTitle, serializeConversation, updateActiveThreadId]);

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
        timestamp: new Date(message.timestamp || thread?.updatedAt || Date.now()),
      })));
    setError(null);
  }, [systemPrompt]);

  useEffect(() => {
    let mounted = true;

    const hydrateThreads = async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const legacyThreadsRaw = await AsyncStorage.getItem(LEGACY_AGENT_THREADS_KEY);
        const importedThreads: AgentThread[] = [];

        if (legacyThreadsRaw) {
          try {
            const parsedLegacyThreads = JSON.parse(legacyThreadsRaw);
            const legacyThreads: AgentThread[] = Array.isArray(parsedLegacyThreads)
              ? parsedLegacyThreads.map(normalizeStoredThread).filter(Boolean) as AgentThread[]
              : [];

            for (const legacyThread of legacyThreads) {
              const legacyPayload = await request(AGENT_CONVERSATIONS_ENDPOINT, {
                method: 'POST',
                body: {
                  conversationId: legacyThread.id,
                  title: legacyThread.title,
                  preview: legacyThread.preview,
                  messages: legacyThread.messages,
                },
              });

              const savedLegacyThread = normalizeStoredThread(legacyPayload?.conversation || legacyPayload);
              if (savedLegacyThread) {
                importedThreads.push(savedLegacyThread);
              }
            }

            await AsyncStorage.multiRemove([LEGACY_AGENT_THREADS_KEY, LEGACY_AGENT_ACTIVE_THREAD_KEY]);
          } catch (_migrationError) {
            // Legacy history import is best-effort; the current backend list still loads below.
          }
        }

        const payload = await request(AGENT_CONVERSATIONS_ENDPOINT);
        const normalizedThreads: AgentThread[] = Array.isArray(payload?.conversations)
          ? payload.conversations.map(normalizeStoredThread).filter(Boolean) as AgentThread[]
          : [];
        const mergedThreads = [...importedThreads, ...normalizedThreads]
          .filter(Boolean)
          .reduce<AgentThread[]>((accumulator, thread) => {
            if (accumulator.some((existing) => existing.id === thread.id)) {
              return accumulator;
            }

            return [...accumulator, thread];
          }, [])
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

        if (!mounted) return;

        setThreads(mergedThreads);
        const draftThreadId = createDraftThreadId();
        updateActiveThreadId(draftThreadId);
        conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
        setChatMessages([]);
        setError(null);
      } catch (_error) {
        if (!mounted) return;
        const draftThreadId = createDraftThreadId();
        setThreads([]);
        updateActiveThreadId(draftThreadId);
        conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
        setChatMessages([]);
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

        const queryPath = (dataType === 'recent_scans' || dataType === 'activity')
          ? `${endpoint}?limit=${encodeURIComponent(String(limit))}`
          : endpoint;
        const payload = await request(queryPath);

        if (dataType === 'recent_scans') {
          const compact = compactRecentScansPayload(payload, limit);
          return JSON.stringify({ ok: true, status: 200, data: compact });
        }

        return JSON.stringify({ ok: true, status: 200, data: payload });
      }

      case 'get_scan_detail': {
        const scanId = String(args?.scanId || '').trim();
        if (!scanId) {
          return JSON.stringify({ error: 'scanId is required' });
        }

        const payload = await request(`/api/scans/${scanId}`);
        const compact = compactScanDetailPayload(payload);
        return JSON.stringify({ ok: true, status: 200, data: compact });
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

      case 'send_message_to_doctor': {
        const doctorName = String(args?.doctorName || '').trim();
        const message = String(args?.message || '').trim();

        if (!doctorName) {
          return JSON.stringify({ error: 'doctorName is required' });
        }

        if (!message) {
          return JSON.stringify({ error: 'message is required' });
        }

        const payload = await request('/api/agent/send-doctor-message', {
          method: 'POST',
          body: {
            doctorName,
            message,
          },
        });

        return JSON.stringify({
          ok: true,
          status: 200,
          data: payload,
          message: payload?.message || payload?.error,
        });
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

    await syncActiveThread(conversationHistoryRef.current).catch(() => null);

    try {
      for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const llmMessages = buildContextWindow(conversationHistoryRef.current);
        const payload = await request('/api/agent', {
          method: 'POST',
          body: {
            messages: llmMessages,
            tools,
          },
        });

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

            await syncActiveThread(conversationHistoryRef.current).catch(() => null);
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

        await syncActiveThread(conversationHistoryRef.current).catch(() => null);
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
    const newThreadId = createDraftThreadId();
    updateActiveThreadId(newThreadId);
    conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
    setChatMessages([]);
    setError(null);
    setIsThinking(false);
    return newThreadId;
  }, [systemPrompt, updateActiveThreadId]);

  const selectThread = useCallback(async (threadId: string) => {
    const selected = threads.find((thread) => thread.id === threadId) || null;
    if (!selected) return;
    updateActiveThreadId(threadId);
    loadThreadIntoMemory(selected);
  }, [loadThreadIntoMemory, threads, updateActiveThreadId]);

  const deleteThread = useCallback(async (threadId: string) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const response = await request(`${AGENT_CONVERSATIONS_ENDPOINT}/${encodeURIComponent(threadId)}`, {
      method: 'DELETE',
    });

    const filtered = threads.filter((thread) => thread.id !== threadId);
    setThreads(filtered);

    if (threadId === activeThreadId) {
      await createNewThread();
    }
  }, [activeThreadId, createNewThread, threads]);

  useEffect(() => {
    if (!activeThreadId || threads.some((thread) => thread.id === activeThreadId)) {
      return;
    }

    conversationHistoryRef.current = [{ role: 'system', content: systemPrompt }];
    setChatMessages([]);
  }, [activeThreadId, systemPrompt, threads]);

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
