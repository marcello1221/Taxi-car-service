import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  SERVICE_CATEGORIES,
  formatUSD,
  type ServiceCategory,
  type Address,
  type PaymentProvider,
} from '@taxi/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const USER_ID = 'user-demo';

const USA_REGION = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

export default function BookScreen() {
  const [category, setCategory] = useState<ServiceCategory>('econom');
  const [pickup, setPickup] = useState<Address | null>(null);
  const [dropoff, setDropoff] = useState<Address | null>(null);
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [quote, setQuote] = useState<{ fare: { total: number }; route: { distanceMiles: number; durationMinutes: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentProvider] = useState<PaymentProvider>('stripe');

  const detectLocation = async (target: 'pickup' | 'dropoff') => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Enable location to detect your address.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const addr: Address = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      formatted: `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
    };
    if (target === 'pickup') {
      setPickup(addr);
      setPickupText(addr.formatted);
    } else {
      setDropoff(addr);
      setDropoffText(addr.formatted);
    }
  };

  const geocode = async (text: string, target: 'pickup' | 'dropoff') => {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: text }),
      });
      const data = await res.json();
      const addr: Address = { formatted: data.formatted || text, lat: data.lat, lng: data.lng };
      if (target === 'pickup') setPickup(addr);
      else setDropoff(addr);
    } catch {
      Alert.alert('Error', 'Could not geocode address');
    }
  };

  const getQuote = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Missing addresses', 'Set pickup and dropoff first.');
      return;
    }
    setLoading(true);
    try {
      const scheduledAt = new Date(Date.now() + 30 * 60000).toISOString();
      const res = await fetch(`${API_URL}/api/rides/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, pickup, dropoff, scheduledAt }),
      });
      const data = await res.json();
      setQuote(data);
    } catch {
      Alert.alert('Error', 'Quote failed');
    } finally {
      setLoading(false);
    }
  };

  const bookRide = async () => {
    if (!pickup || !dropoff || !quote) return;
    setLoading(true);
    try {
      const scheduledAt = new Date(Date.now() + 30 * 60000).toISOString();
      const res = await fetch(`${API_URL}/api/rides/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, category, pickup, dropoff, scheduledAt, paymentProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      Alert.alert('Booked!', `Locked fare: ${formatUSD(data.ride.lockedFare)}`);
      setQuote(null);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🚕 Book a Ride</Text>
      <Text style={styles.subtitle}>USA pre-book service</Text>

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={USA_REGION}
        region={
          pickup
            ? { latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
            : USA_REGION
        }
      >
        {pickup && <Marker coordinate={pickup} title="Pickup" pinColor="#00d4aa" />}
        {dropoff && <Marker coordinate={dropoff} title="Dropoff" pinColor="#7c3aed" />}
      </MapView>

      <View style={styles.categories}>
        {(Object.keys(SERVICE_CATEGORIES) as ServiceCategory[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.catBtn, category === key && styles.catActive]}
            onPress={() => setCategory(key)}
          >
            <Text style={styles.catLabel}>{SERVICE_CATEGORIES[key].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pickup</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={pickupText}
            onChangeText={setPickupText}
            onBlur={() => geocode(pickupText, 'pickup')}
            placeholder="Enter USA address"
            placeholderTextColor="#8b95b5"
          />
          <TouchableOpacity style={styles.locBtn} onPress={() => detectLocation('pickup')}>
            <Text>📍</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dropoff</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={dropoffText}
            onChangeText={setDropoffText}
            onBlur={() => geocode(dropoffText, 'dropoff')}
            placeholder="Enter destination"
            placeholderTextColor="#8b95b5"
          />
          <TouchableOpacity style={styles.locBtn} onPress={() => detectLocation('dropoff')}>
            <Text>📍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {quote && (
        <View style={styles.quoteBox}>
          <Text style={styles.quoteTotal}>{formatUSD(quote.fare.total)}</Text>
          <Text style={styles.quoteMeta}>
            {quote.route.distanceMiles} mi · {Math.round(quote.route.durationMinutes)} min ETA
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginVertical: 16 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.btnSecondary} onPress={getQuote}>
            <Text style={styles.btnText}>Get Quote</Text>
          </TouchableOpacity>
          {quote && (
            <TouchableOpacity style={styles.btnPrimary} onPress={bookRide}>
              <Text style={styles.btnTextDark}>Confirm & Pay</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e17' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#f0f4ff' },
  subtitle: { color: '#8b95b5', marginBottom: 16 },
  map: { height: 200, borderRadius: 16, marginBottom: 16 },
  categories: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  catBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1a2238',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catActive: { borderColor: '#00d4aa' },
  catLabel: { color: '#f0f4ff', fontWeight: '600', fontSize: 12 },
  field: { marginBottom: 12 },
  label: { color: '#8b95b5', fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1a2238',
    borderRadius: 10,
    padding: 12,
    color: '#f0f4ff',
  },
  locBtn: {
    backgroundColor: '#1a2238',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
  },
  quoteBox: {
    backgroundColor: '#1a2238',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  quoteTotal: { fontSize: 28, fontWeight: '800', color: '#00d4aa' },
  quoteMeta: { color: '#8b95b5', marginTop: 4 },
  btnPrimary: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSecondary: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  btnTextDark: { color: '#0a0e17', fontWeight: '700' },
});
