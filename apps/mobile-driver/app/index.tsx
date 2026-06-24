import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SERVICE_CATEGORIES, type RideForDriver, type RideMessage, type Address } from '@taxi/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app';
const DRIVER_ID = 'driver-demo';

function openInGoogleMaps(address: Address) {
  const query = encodeURIComponent(address.formatted);
  const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Maps', 'Could not open Google Maps');
  });
}

function formatPhone(phone?: string) {
  if (!phone) return 'No phone on file';
  return phone;
}

export default function RidesScreen() {
  const [rides, setRides] = useState<RideForDriver[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [chatRide, setChatRide] = useState<RideForDriver | null>(null);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchRides = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rides/available`);
      const data = await res.json();
      setRides(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert('Error', 'Could not load rider orders');
    }
  }, []);

  const fetchMessages = useCallback(async (rideId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/messages`);
      const data = await res.json();
      if (res.ok) setMessages(Array.isArray(data) ? data : []);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 15000);
    return () => clearInterval(interval);
  }, [fetchRides]);

  useEffect(() => {
    if (!chatRide) return;
    fetchMessages(chatRide.id);
    const interval = setInterval(() => fetchMessages(chatRide.id), 5000);
    return () => clearInterval(interval);
  }, [chatRide, fetchMessages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const bookRide = async (rideId: string) => {
    setBookingId(rideId);
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: DRIVER_ID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to book ride');
      Alert.alert('Booked', 'This ride is now assigned to you.');
      setChatRide(rides.find((r) => r.id === rideId) ?? null);
      fetchRides();
    } catch (err) {
      Alert.alert('Error', String(err).replace('Error: ', ''));
    } finally {
      setBookingId(null);
    }
  };

  const sendMessage = async () => {
    if (!chatRide || !messageText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/rides/${chatRide.id}/messages`, {
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
      Alert.alert('Message failed', String(err).replace('Error: ', ''));
    } finally {
      setSending(false);
    }
  };

  const renderRide = ({ item }: { item: RideForDriver }) => {
    const cat = SERVICE_CATEGORIES[item.category];
    const scheduled = new Date(item.scheduledAt);
    const isBooking = bookingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.badge, { backgroundColor: cat.accent }]}>{cat.label}</Text>
          <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
        </View>

        <View style={styles.riderBlock}>
          <Text style={styles.riderName}>{item.rider.name}</Text>
          <TouchableOpacity onPress={() => item.rider.phone && Linking.openURL(`sms:${item.rider.phone}`)}>
            <Text style={styles.riderPhone}>{formatPhone(item.rider.phone)}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Pickup</Text>
        <TouchableOpacity onPress={() => openInGoogleMaps(item.pickup)}>
          <Text style={styles.addressLink}>{item.pickup.formatted}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Dropoff</Text>
        <TouchableOpacity onPress={() => openInGoogleMaps(item.dropoff)}>
          <Text style={styles.addressLink}>{item.dropoff.formatted}</Text>
        </TouchableOpacity>

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>
            {scheduled.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={styles.timeText}>
            {scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={styles.noteBlock}>
          <Text style={styles.sectionLabel}>Rider note</Text>
          <Text style={styles.noteText}>{item.note?.trim() || 'No note provided'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnMessage} onPress={() => setChatRide(item)}>
            <Text style={styles.btnMessageText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnBook}
            onPress={() => bookRide(item.id)}
            disabled={isBooking}
          >
            <Text style={styles.btnBookText}>{isBooking ? 'Booking…' : 'Book'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rider Orders</Text>
      <Text style={styles.subtitle}>{rides.length} open order(s)</Text>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No rider orders right now</Text>
            <Text style={styles.emptySub}>Pull to refresh</Text>
          </View>
        }
      />

      <Modal visible={!!chatRide} animationType="slide" onRequestClose={() => setChatRide(null)}>
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatTitle}>Message {chatRide?.rider.name}</Text>
              <Text style={styles.chatSub}>{chatRide?.pickup.formatted}</Text>
            </View>
            <TouchableOpacity onPress={() => setChatRide(null)}>
              <Text style={styles.chatClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
            {messages.length === 0 ? (
              <Text style={styles.chatEmpty}>No messages yet. Say hi to your rider.</Text>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[styles.messageBubble, msg.senderRole === 'driver' ? styles.messageMine : styles.messageTheirs]}
                >
                  <Text style={[styles.messageBody, msg.senderRole !== 'driver' && styles.messageBodyLight]}>{msg.body}</Text>
                  <Text style={[styles.messageTime, msg.senderRole !== 'driver' && styles.messageTimeLight]}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Text your rider…"
              placeholderTextColor="#8b95b5"
              multiline
            />
            <TouchableOpacity style={styles.chatSend} onPress={sendMessage} disabled={sending || !messageText.trim()}>
              <Text style={styles.chatSendText}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e17' },
  title: { fontSize: 24, fontWeight: '800', color: '#f0f4ff', padding: 16, paddingBottom: 4 },
  subtitle: { color: '#8b95b5', paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: {
    backgroundColor: '#12182a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, color: '#0a0e17', fontWeight: '700', fontSize: 12 },
  orderId: { color: '#8b95b5', fontSize: 12 },
  riderBlock: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  riderName: { color: '#f0f4ff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  riderPhone: { color: '#f59e0b', fontSize: 15 },
  sectionLabel: { color: '#8b95b5', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  addressLink: { color: '#00d4aa', fontSize: 15, lineHeight: 22, textDecorationLine: 'underline' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  dateText: { color: '#f0f4ff', fontSize: 14, fontWeight: '600' },
  timeText: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },
  noteBlock: { marginTop: 8 },
  noteText: { color: '#c5cee0', fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnMessage: {
    flex: 1,
    backgroundColor: '#12182a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00d4aa',
  },
  btnMessageText: { color: '#00d4aa', fontWeight: '700', fontSize: 15 },
  btnBook: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnBookText: { color: '#0a0e17', fontWeight: '800', fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#8b95b5', fontSize: 16 },
  emptySub: { color: '#8b95b5', fontSize: 12, marginTop: 4 },
  chatContainer: { flex: 1, backgroundColor: '#0a0e17' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chatTitle: { color: '#f0f4ff', fontSize: 18, fontWeight: '700' },
  chatSub: { color: '#8b95b5', fontSize: 12, marginTop: 4 },
  chatClose: { color: '#f59e0b', fontWeight: '700', fontSize: 16 },
  chatMessages: { flex: 1 },
  chatMessagesContent: { padding: 16, gap: 10 },
  chatEmpty: { color: '#8b95b5', textAlign: 'center', marginTop: 40 },
  messageBubble: { maxWidth: '85%', borderRadius: 14, padding: 12 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#f59e0b' },
  messageTheirs: { alignSelf: 'flex-start', backgroundColor: '#12182a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  messageBody: { color: '#0a0e17', fontSize: 15, lineHeight: 20 },
  messageBodyLight: { color: '#f0f4ff' },
  messageTime: { color: 'rgba(10,14,23,0.6)', fontSize: 10, marginTop: 6 },
  messageTimeLight: { color: '#8b95b5' },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#12182a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f0f4ff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatSend: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatSendText: { color: '#0a0e17', fontWeight: '800' },
});
