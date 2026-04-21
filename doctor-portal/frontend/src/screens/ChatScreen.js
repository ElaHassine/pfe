import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, useWindowDimensions, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doctorPortalApi } from '../services/api';

function formatTime(value) {
  const date = new Date(value || Date.now());
  const diff = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function patientInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PA';
  const first = parts[0]?.[0] || 'P';
  const second = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) || 'A';
  return `${first}${second}`.toUpperCase();
}

function PatientAvatar({ name, avatarUrl, size = 40 }) {
  const initials = patientInitials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(0,194,178,0.14)',
        borderWidth: 1.5,
        borderColor: 'rgba(0,194,178,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: Math.max(11, Math.floor(size * 0.32)), color: '#00A99D' }}>{initials}</Text>
      )}
    </View>
  );
}

export default function ChatScreen({ navigate }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messagesByThread, setMessagesByThread] = useState({});
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) || null, [threads, activeThreadId]);
  const activeMessages = messagesByThread[activeThreadId] || [];

  const loadThreads = async () => {
    try {
      const response = await doctorPortalApi.listChatThreads();
      const list = (response.threads || []).map((thread) => ({
        id: String(thread.id),
        patientName: thread.patientName,
        patientId: thread.patientId,
        patientAvatarUrl: thread.patientAvatarUrl || '',
        specialty: thread.specialty,
        lastMessage: thread.lastMessage || 'Start conversation',
        lastMessageAt: thread.lastMessageAt,
        unread: thread.unread || 0,
      }));
      setThreads(list);
      if (!activeThreadId && list[0]?.id) {
        setActiveThreadId(list[0].id);
      }
    } catch (_error) {
      setThreads([]);
    }
  };

  const loadMessages = async (threadId) => {
    if (!threadId) return;
    try {
      const response = await doctorPortalApi.getChatMessages(threadId);
      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: (response.messages || []).map((message) => ({
          id: String(message.id),
          senderType: message.senderType,
          senderName: message.senderName,
          body: message.body,
          createdAt: message.createdAt,
        })),
      }));
      setThreads((prev) => prev.map((thread) => (
        thread.id === threadId ? { ...thread, unread: 0 } : thread
      )));
    } catch (_error) {
      setMessagesByThread((prev) => ({ ...prev, [threadId]: [] }));
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    loadMessages(activeThreadId);
  }, [activeThreadId]);

  const visibleThreads = threads.filter((thread) => thread.patientName.toLowerCase().includes(search.toLowerCase()));

  const sendMessage = async () => {
    if (!activeThreadId) return;
    const text = draft.trim();
    if (!text) return;

    try {
      const response = await doctorPortalApi.sendChatMessage(activeThreadId, text);
      const nextMessage = {
        id: String(response.message.id),
        senderType: response.message.senderType,
        senderName: response.message.senderName,
        body: response.message.body,
        createdAt: response.message.createdAt,
      };

      setMessagesByThread((prev) => {
        const list = prev[activeThreadId] || [];
        return { ...prev, [activeThreadId]: [...list, nextMessage] };
      });
      setThreads((prev) => prev.map((thread) => (
        thread.id === activeThreadId
          ? { ...thread, lastMessage: text, lastMessageAt: new Date().toISOString(), unread: 0 }
          : thread
      )));
      setDraft('');
    } catch (_error) {
      // Keep chat usable even if send fails.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F8FB', flexDirection: isDesktop ? 'row' : 'column' }}>
      <View style={{ width: isDesktop ? 340 : '100%', borderRightWidth: isDesktop ? 1 : 0, borderRightColor: '#EEF1F6', backgroundColor: '#fff' }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEF1F6' }}>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 20, color: '#1A2235', marginBottom: 10 }}>Patient Chats</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FB', borderRadius: 10, borderWidth: 1.5, borderColor: '#DDE3EE', paddingHorizontal: 12, minHeight: 44 }}>
            <Feather name="search" size={15} color="#A8B4CC" style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search patients"
              placeholderTextColor="#A8B4CC"
              style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
          {visibleThreads.map((thread) => (
            <TouchableOpacity
              key={thread.id}
              onPress={() => setActiveThreadId(thread.id)}
              activeOpacity={0.82}
              style={{
                backgroundColor: thread.id === activeThreadId ? 'rgba(0,194,178,0.12)' : '#fff',
                borderWidth: 1,
                borderColor: thread.id === activeThreadId ? 'rgba(0,194,178,0.3)' : '#EEF1F6',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <PatientAvatar name={thread.patientName} avatarUrl={thread.patientAvatarUrl} size={42} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{thread.patientName}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#A8B4CC' }}>{formatTime(thread.lastMessageAt)}</Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }} numberOfLines={1}>{thread.lastMessage}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {activeThread ? (
          <>
            <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F6', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PatientAvatar name={activeThread.patientName} avatarUrl={activeThread.patientAvatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235' }}>{activeThread.patientName}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>Doctor conversation</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigate && navigate('patient-history', {
                  historyContext: {
                    patientId: activeThread.patientId,
                    patientName: activeThread.patientName,
                    from: 'messages',
                  },
                })}
                activeOpacity={0.8}
                style={{ minHeight: 36, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,194,178,0.12)', borderWidth: 1, borderColor: 'rgba(0,194,178,0.35)' }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00A99D' }}>View Full History</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {activeMessages.map((message) => {
                const mine = message.senderType === 'doctor';
                return (
                  <View
                    key={message.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      backgroundColor: mine ? '#00C2B2' : '#F6F8FB',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: mine ? '#050E1F' : '#3A4560' }}>{message.body}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderTopColor: '#EEF1F6', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message"
                placeholderTextColor="#A8B4CC"
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: '#DDE3EE',
                  paddingHorizontal: 14,
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 13,
                  color: '#1A2235',
                }}
              />
              <TouchableOpacity onPress={sendMessage} activeOpacity={0.82} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="send" size={16} color="#050E1F" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#A8B4CC' }}>No chats yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}
