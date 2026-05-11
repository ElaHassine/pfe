import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AgentChatScreenWeb({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Lesio Assistant</Text>
        <Text style={styles.body}>
          Voice chat is available in the native mobile app. On web, the assistant screen is disabled to keep the app stable.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation?.goBack?.()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: '#475569', marginBottom: 20 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2B6CB0', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
