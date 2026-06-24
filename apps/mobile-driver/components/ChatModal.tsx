import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RideForDriver, RideMessage } from '@taxi/shared';
import { API_URL, DRIVER_ID, theme } from '../constants';

type Props = {
  ride: RideForDriver | null;
  onClose: () => void;
};

export default function ChatModal({ ride, onClose }: Props) {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!ride) return;
    let cancelled = false;

    const load = async (showError: boolean) => {
      try {
        const res = await fetch(`${API_URL}/api/rides/${ride.id}/messages`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Chat unavailable');
        if (!cancelled) setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (showError && !cancelled) {
          Alert.alert('Chat unavailable', err instanceof Error ? err.message : 'Chat is only open during active trips');
        }
      }
    };

    load(true);
    const interval = setInterval(() => load(false), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ride]);

  const sendMessage = async () => {
    if (!ride || !messageText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/rides/${ride.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: DRIVER_ID,
          senderRole: 'driver',
          body: messageText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setMessageText('');
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      Alert.alert('Message failed', err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const riderName = ride?.rider?.name ?? 'Rider';

  return (
    <Modal visible={!!ride} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Chat with {riderName}</Text>
              <Text style={styles.sub}>{ride?.pickup.formatted}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
            {messages.length === 0 ? (
              <Text style={styles.empty}>Chat is open for this active trip only.</Text>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[styles.bubble, msg.senderRole === 'driver' ? styles.mine : styles.theirs]}
                >
                  <Text style={[styles.body, msg.senderRole !== 'driver' && styles.bodyLight]}>{msg.body}</Text>
                  <Text style={[styles.time, msg.senderRole !== 'driver' && styles.timeLight]}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Write a message…"
              placeholderTextColor={theme.muted}
              multiline
            />
            <TouchableOpacity style={styles.send} onPress={sendMessage} disabled={sending || !messageText.trim()}>
              <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: '700' },
  sub: { color: theme.muted, fontSize: 12, marginTop: 4 },
  close: { color: theme.accent, fontWeight: '700', fontSize: 16 },
  messages: { flex: 1 },
  messagesContent: { padding: 16 },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 40 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12, marginBottom: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  body: { color: theme.bg, fontSize: 15, lineHeight: 20 },
  bodyLight: { color: theme.text },
  time: { color: 'rgba(10,14,23,0.6)', fontSize: 10, marginTop: 6 },
  timeLight: { color: theme.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 10,
  },
  send: { backgroundColor: theme.teal, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: theme.bg, fontWeight: '800' },
});
