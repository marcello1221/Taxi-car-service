import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RideForDriver } from '@taxi/shared';
import { API_URL, DRIVER_ID, theme, type TabKey } from '../constants';
import DriverHeader from '../components/DriverHeader';
import OrderCard from '../components/OrderCard';
import ChatModal from '../components/ChatModal';

export default function DriverPlatform() {
  const [tab, setTab] = useState<TabKey>('orders');
  const [orders, setOrders] = useState<RideForDriver[]>([]);
  const [trips, setTrips] = useState<RideForDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [chatRide, setChatRide] = useState<RideForDriver | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoadError('');
      const [ordersRes, tripsRes] = await Promise.all([
        fetch(`${API_URL}/api/rides/available`),
        fetch(`${API_URL}/api/rides/driver/${DRIVER_ID}`),
      ]);
      const ordersData = await ordersRes.json();
      const tripsData = await tripsRes.json();
      if (!ordersRes.ok) {
        throw new Error(typeof ordersData?.error === 'string' ? ordersData.error : 'Could not load orders');
      }
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load driver platform');
      setOrders([]);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
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
      if (!res.ok) throw new Error(data.error || 'Failed to book trip');
      Alert.alert('Trip booked', 'Client contact and chat are now available under My trips.');
      setTab('trips');
      fetchData();
    } catch (err) {
      Alert.alert('Booking failed', err instanceof Error ? err.message : 'Could not book trip');
    } finally {
      setBookingId(null);
    }
  };

  const completeRide = async (rideId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/complete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete trip');
      Alert.alert('Trip completed', 'Ride marked complete.');
      fetchData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not complete trip');
    }
  };

  const listData = tab === 'orders' ? orders : trips;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <DriverHeader
        onRefresh={onRefresh}
        refreshing={refreshing}
        orderCount={orders.length}
        tripCount={trips.length}
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'orders' && styles.tabActive]}
          onPress={() => setTab('orders')}
        >
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>New orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'trips' && styles.tabActive]}
          onPress={() => setTab('trips')}
        >
          <Text style={[styles.tabText, tab === 'trips' && styles.tabTextActive]}>My trips</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.centerSub}>Loading driver platform…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.error}>{loadError}</Text>
          <TouchableOpacity style={styles.retry} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <OrderCard
              ride={item}
              mode={tab === 'orders' ? 'available' : 'assigned'}
              booking={bookingId === item.id}
              onBook={() => bookRide(item.id)}
              onMessage={tab === 'trips' ? () => setChatRide(item) : undefined}
              onComplete={() => completeRide(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {tab === 'orders' ? 'No new rider orders' : 'No active trips'}
              </Text>
              <Text style={styles.centerSub}>
                {tab === 'orders'
                  ? 'When riders book on the website, orders appear here.'
                  : 'Book a trip from New orders to see it here.'}
              </Text>
            </View>
          }
        />
      )}

      <ChatModal ride={chatRide} onClose={() => setChatRide(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: theme.surfaceAlt },
  tabText: { color: theme.muted, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: theme.text },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 280 },
  centerSub: { color: theme.muted, fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  error: { color: theme.danger, fontSize: 16, textAlign: 'center', marginBottom: 12 },
  retry: { backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: theme.bg, fontWeight: '700' },
});
