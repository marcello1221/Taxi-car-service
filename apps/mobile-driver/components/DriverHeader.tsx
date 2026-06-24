import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants';

type Props = {
  onRefresh: () => void;
  refreshing: boolean;
  orderCount: number;
  tripCount: number;
};

export default function DriverHeader({ onRefresh, refreshing, orderCount, tripCount }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>Driver platform</Text>
          <Text style={styles.name}>Jordan Driver</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Online</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{orderCount}</Text>
          <Text style={styles.statLabel}>New orders</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{tripCount}</Text>
          <Text style={styles.statLabel}>My trips</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing}>
          <Text style={styles.refreshText}>{refreshing ? '…' : '↻'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  kicker: { color: theme.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.teal, marginRight: 8 },
  statusText: { color: theme.teal, fontWeight: '700', fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.accent, fontSize: 22, fontWeight: '800' },
  statLabel: { color: theme.muted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.border },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  refreshText: { color: theme.accent, fontSize: 22, fontWeight: '700' },
});
