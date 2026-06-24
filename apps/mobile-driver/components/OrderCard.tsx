import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SERVICE_CATEGORIES, type RideForDriver } from '@taxi/shared';
import { theme } from '../constants';

type Props = {
  ride: RideForDriver;
  mode: 'available' | 'assigned';
  booking?: boolean;
  onBook?: () => void;
  onMessage?: () => void;
  onComplete?: () => void;
};

function getRider(ride: RideForDriver) {
  return ride.rider ?? { name: '', phone: undefined };
}

function formatSchedule(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function OrderCard({ ride, mode, booking, onBook, onMessage, onComplete }: Props) {
  const cat = SERVICE_CATEGORIES[ride.category] ?? SERVICE_CATEGORIES.econom;
  const rider = getRider(ride);
  const schedule = formatSchedule(ride.scheduledAt);
  const showContact = mode === 'assigned' && !!rider.name;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.content}>
          <View style={styles.cardTop}>
            <View style={styles.schedulePill}>
              <Text style={styles.scheduleDate}>{schedule.date}</Text>
              <Text style={styles.scheduleTime}>{schedule.time}</Text>
            </View>
            <Text style={[styles.badge, { backgroundColor: cat.accent }]}>{cat.label}</Text>
          </View>

          <View style={styles.routeStop}>
            <View style={[styles.dot, { backgroundColor: theme.pickup }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>Pickup</Text>
              <Text style={styles.stopAddress}>{ride.pickup.formatted}</Text>
            </View>
          </View>

          <View style={styles.routeStop}>
            <View style={[styles.dot, { backgroundColor: theme.dropoff }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>Dropoff</Text>
              <Text style={styles.stopAddress}>{ride.dropoff.formatted}</Text>
            </View>
          </View>

          {ride.note?.trim() ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Rider note</Text>
              <Text style={styles.noteText}>{ride.note.trim()}</Text>
            </View>
          ) : null}

          {showContact ? (
            <View style={styles.contactBox}>
              <Text style={styles.contactLabel}>Client contact</Text>
              <Text style={styles.riderName}>{rider.name}</Text>
              <Text style={styles.riderPhone}>{rider.phone || 'No phone on file'}</Text>
              {rider.phone ? (
                <View style={styles.contactRow}>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${rider.phone}`)}>
                    <Text style={styles.contactBtnText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`sms:${rider.phone}`)}>
                    <Text style={styles.contactBtnText}>Text</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : mode === 'available' ? (
            <Text style={styles.contactHint}>Client contact unlocks after you book.</Text>
          ) : null}

          {mode === 'assigned' ? (
            <View style={styles.tripActions}>
              <TouchableOpacity style={styles.btnMessage} onPress={onMessage}>
                <Text style={styles.btnMessageText}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnComplete} onPress={onComplete}>
                <Text style={styles.btnCompleteText}>Complete trip</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {mode === 'available' ? (
          <TouchableOpacity
            style={[styles.bookSide, booking && styles.bookSideDisabled]}
            onPress={onBook}
            disabled={booking}
          >
            <Text style={styles.bookSideText}>{booking ? '…' : 'Book'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  content: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  schedulePill: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scheduleDate: { color: theme.text, fontWeight: '700', fontSize: 13 },
  scheduleTime: { color: theme.accent, fontWeight: '800', fontSize: 16, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, color: theme.bg, fontWeight: '800', fontSize: 11 },
  routeStop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10, marginTop: 4 },
  stopLabel: { color: theme.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  stopAddress: { color: theme.text, fontSize: 14, lineHeight: 20 },
  noteBox: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  noteLabel: { color: theme.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  noteText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  contactHint: { color: theme.muted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  contactBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  contactLabel: { color: theme.teal, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  riderName: { color: theme.text, fontSize: 17, fontWeight: '700' },
  riderPhone: { color: theme.accent, fontSize: 15, marginTop: 4 },
  contactRow: { flexDirection: 'row', marginTop: 10 },
  contactBtn: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  contactBtnText: { color: theme.teal, fontWeight: '700', fontSize: 12 },
  tripActions: { flexDirection: 'row', marginTop: 14 },
  btnMessage: {
    flex: 1,
    marginRight: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.teal,
  },
  btnMessageText: { color: theme.teal, fontWeight: '700' },
  btnComplete: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.teal,
  },
  btnCompleteText: { color: theme.bg, fontWeight: '800' },
  bookSide: {
    width: 72,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  bookSideDisabled: { opacity: 0.6 },
  bookSideText: {
    color: theme.bg,
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
  },
});
