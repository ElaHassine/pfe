import React, { useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar, Modal, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { usePatientAgent } from '../hooks/usePatientAgent';
import { PATIENT_SYSTEM_PROMPT } from '../ai/systemPrompt';
import { patientTools } from '../ai/patientTools';

export default function AgentChatScreen() {
  const navigation = useNavigation();
  const {
    chatMessages,
    isThinking,
    error,
    sendMessage,
    threads,
    activeThreadId,
    createNewThread,
    selectThread,
    deleteThread,
  } = usePatientAgent(PATIENT_SYSTEM_PROMPT, patientTools as any);
  const [text, setText] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const listRef = useRef<FlatList<any> | null>(null);

  const renderHistorySwipeActions = () => (
    <View style={styles.deleteAction}>
      <Feather name="trash-2" size={18} color="#fff" />
    </View>
  );

  const confirmDeleteThread = (threadId: string) => {
    Alert.alert(
      'Delete conversation?',
      'This will permanently remove the selected chat from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteThread(threadId).catch(() => null);
          },
        },
      ]
    );
  };

  const handleSend = () => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true } as any), 100);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#050E1F', '#0D2147']} style={styles.gradientHeader}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle} numberOfLines={1}>Lesio Assistant</Text>

            <TouchableOpacity 
              onPress={() => setIsHistoryOpen(true)} 
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="clock" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.messageText, item.role === 'user' ? styles.userText : styles.assistantText]}>
              {item.text}
            </Text>
          </View>
        )}
      />

      {isThinking && (
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color="#2B6CB0" />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#C53030" style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          placeholder="Ask about your scans..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          maxLength={500}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim()}
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="send" size={18} color={text.trim() ? '#fff' : '#ccc'} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isHistoryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHistoryOpen(false)}
      >
        <Pressable style={styles.historyBackdrop} onPress={() => setIsHistoryOpen(false)}>
          <Pressable style={styles.historySheet} onPress={() => {}}>
            <View style={styles.historySheetHeader}>
              <Text style={styles.historySheetTitle}>Chat history</Text>
              <TouchableOpacity onPress={() => setIsHistoryOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newChatButton}
              onPress={async () => {
                await createNewThread();
                setText('');
                setIsHistoryOpen(false);
              }}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.newChatButtonText}>New chat</Text>
            </TouchableOpacity>

            <FlatList
              data={threads}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Swipeable
                  key={item.id}
                  renderRightActions={renderHistorySwipeActions}
                  rightThreshold={44}
                  overshootRight={false}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'right') {
                      confirmDeleteThread(item.id);
                    }
                  }}
                >
                  <TouchableOpacity
                    style={[styles.historyItem, item.id === activeThreadId && styles.historyItemActive]}
                    onPress={async () => {
                      await selectThread(item.id);
                      setText('');
                      setIsHistoryOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>{item.title || 'New conversation'}</Text>
                      <Text style={styles.historyItemPreview} numberOfLines={2}>{item.preview || 'Start a conversation'}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </Swipeable>
              )}
              ListEmptyComponent={(
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyText}>No saved chats yet.</Text>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  gradientHeader: { paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, minHeight: 56 },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  messages: { padding: 16, paddingBottom: 12 },
  bubble: { marginVertical: 8, padding: 14, borderRadius: 16, maxWidth: '85%' },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0D2147',
    marginLeft: '15%',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0F8',
    marginRight: '15%',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#D6E4F0',
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#fff' },
  assistantText: { color: '#1F2937' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  thinkingText: { marginLeft: 10, color: '#0D2147', fontSize: 14, fontWeight: '500' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FEE', marginHorizontal: 16, borderRadius: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#C53030' },
  errorText: { color: '#C53030', fontSize: 13, flex: 1, fontWeight: '500' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 22, fontSize: 15, color: '#1F2937', borderWidth: 1.5, borderColor: '#E5E7EB' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0D2147', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  sendButtonDisabled: { backgroundColor: '#E5E7EB' },
  historyBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  historySheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, maxHeight: '78%' },
  historySheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  historySheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  newChatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0D2147', borderRadius: 14, paddingVertical: 12, marginBottom: 12 },
  newChatButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F8FAFC', marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  historyItemActive: { borderColor: '#0D2147', backgroundColor: '#EEF4FF' },
  historyItemTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  historyItemPreview: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  historyEmpty: { paddingVertical: 24, alignItems: 'center' },
  historyEmptyText: { color: '#64748B' },
  deleteAction: { width: 96, flex: 1, borderRadius: 14, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginRight: 2 },
});
