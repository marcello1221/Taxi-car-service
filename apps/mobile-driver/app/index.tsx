import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SERVICE_CATEGORIES, formatUSD, type Ride } from '@taxi/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const DRIVER_ID = 'driver-demo';

export default function RidesScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRides = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rides/available`);
      const data = await res.json();
      setRides(data);
    } catch {
      Alert.alert('Error', 'Could not load rides');
    }
  }, []);

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 15000);
    return () => clearInterval(interval);
  }, [fetchRides]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const acceptRide = async (rideId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: DRIVER_ID }),
      });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Accepted', 'Ride assigned to you!');
      fetchRides();
    } catch {
      Alert.alert('Error', 'Could not accept ride');
    }
  };

  const completeRide = async (rideId: string) => {
    try {
      await fetch(`${API_URL}/api/rides/${rideId}/complete`, { method: 'POST' });
      Alert.alert('Done', 'Ride completed. Payout based on actual route.');
      fetchRides();
    } catch {
      Alert.alert('Error', 'Could not complete ride');
    }
  };

  const renderRide = ({ item }: { item: Ride }) => {
    const cat = SERVICE_CATEGORIES[item.category];
    const scheduled = new Date(item.scheduledAt);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.badge, { backgroundColor: cat.accent }]}>{cat.label}</Text>
          <Text style={styles.fare}>{formatUSD(item.lockedFare)}</Text>
        </View>
        <Text style={styles.address}>📍 {item.pickup.formatted}</Text>
        <Text style={styles.address}>🏁 {item.dropoff.formatted}</Text>
        <Text style={styles.time}>
          {scheduled.toLocaleDateString()} · {scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.meta}>
          {item.lockedFareBreakdown.distanceMiles} mi · {Math.round(item.lockedFareBreakdown.durationMinutes)} min
        </Text>

        <MapView
          style={styles.miniMap}
          provider={PROVIDER_GOOGLE}
          scrollEnabled={false}
          initialRegion={{
            latitude: item.pickup.lat,
            longitude: item.pickup.lng,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
        >
          <Marker coordinate={item.pickup} pinColor="#00d4aa" />
          <Marker coordinate={item.dropoff} pinColor="#7c3aed" />
        </MapView>

        {item.driverId === DRIVER_ID ? (
          <TouchableOpacity style={styles.btnComplete} onPress={() => completeRide(item.id)}>
            <Text style={styles.btnText}>Complete Ride</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnAccept} onPress={() => acceptRide(item.id)}>
            <Text style={styles.btnTextDark}>Accept Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚗 Available Pre-Book Rides</Text>
      <Text style={styles.subtitle}>{rides.length} ride(s) waiting</Text>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No pre-book rides right now</Text>
            <Text style={styles.emptySub}>Pull to refresh</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e17' },
  title: { fontSize: 24, fontWeight: '800', color: '#f0f4ff', padding: 16, paddingBottom: 4 },
  subtitle: { color: '#8b95b5', paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: '#12182a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, color: '#0a0e17', fontWeight: '700', fontSize: 12 },
  fare: { fontSize: 20, fontWeight: '800', color: '#f59e0b' },
  address: { color: '#f0f4ff', fontSize: 13, marginBottom: 4 },
  time: { color: '#8b95b5', fontSize: 12, marginTop: 4 },
  meta: { color: '#8b95b5', fontSize: 12, marginBottom: 8 },
  miniMap: { height: 120, borderRadius: 12, marginBottom: 12 },
  btnAccept: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnComplete: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnText: { color: '#0a0e17', fontWeight: '700' },
  btnTextDark: { color: '#0a0e17', fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#8b95b5', fontSize: 16 },
  emptySub: { color: '#8b95b5', fontSize: 12, marginTop: 4 },
});
