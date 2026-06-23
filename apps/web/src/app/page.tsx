'use client';

import { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import {
  SERVICE_CATEGORIES,
  formatUSD,
  type ServiceCategory,
  type Address,
  type PaymentProvider,
  type Ride,
} from '@taxi/shared';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const USA_CENTER = { lat: 39.8283, lng: -98.5795 };
const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions: google.maps.MapOptions = {
  restriction: { latLngBounds: { north: 49.5, south: 24.5, west: -125, east: -66 }, strictBounds: false },
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8b95b5' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2238' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  ],
  disableDefaultUI: true,
  zoomControl: true,
};

type Quote = {
  route: { distanceMiles: number; durationMinutes: number; durationInTrafficMinutes?: number };
  fare: { total: number; baseFare: number; mileageCharge: number; timeCharge: number };
};

export default function HomePage() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: ['places'] });

  const [step, setStep] = useState<'book' | 'confirm' | 'success'>('book');
  const [category, setCategory] = useState<ServiceCategory>('econom');
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickup, setPickup] = useState<Address | null>(null);
  const [dropoff, setDropoff] = useState<Address | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('stripe');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookedRide, setBookedRide] = useState<Ride | null>(null);
  const [pendingApproval, setPendingApproval] = useState<Ride | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userId] = useState('user-demo');

  useEffect(() => {
    const minDate = new Date(Date.now() + 15 * 60000);
    setScheduledAt(minDate.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/rides/user/${userId}`);
        const rides: Ride[] = await res.json();
        const pending = rides.find((r) => r.status === 'awaiting_eta_approval');
        if (pending) setPendingApproval(pending);
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const detectLocation = useCallback(async (target: 'pickup' | 'dropoff') => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const formatted = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const addr: Address = { formatted, lat, lng };
      if (target === 'pickup') {
        setPickup(addr);
        setPickupText(formatted);
      } else {
        setDropoff(addr);
        setDropoffText(formatted);
      }
    }, () => setError('Location permission denied'));
  }, []);

  const geocodeField = async (text: string, target: 'pickup' | 'dropoff') => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const addr: Address = { formatted: data.formatted, lat: data.lat, lng: data.lng };
      if (target === 'pickup') setPickup(addr);
      else setDropoff(addr);
    } catch (err) {
      const parts = text.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const addr: Address = { formatted: text, lat: parts[0], lng: parts[1] };
        if (target === 'pickup') setPickup(addr);
        else setDropoff(addr);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !pickup || !dropoff) return;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) setDirections(result);
      }
    );
  }, [isLoaded, pickup, dropoff]);

  const getQuote = async () => {
    if (!pickup || !dropoff) {
      setError('Set pickup and dropoff addresses');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rides/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, pickup, dropoff, scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuote(data);
      setStep('confirm');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rides/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          category,
          pickup,
          dropoff,
          scheduledAt: new Date(scheduledAt).toISOString(),
          paymentProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookedRide(data.ride);
      setStep('success');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEtaApproval = async (approved: boolean) => {
    if (!pendingApproval) return;
    await fetch(`${API_URL}/api/rides/${pendingApproval.id}/eta-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    setPendingApproval(null);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🚕</span>
          <div>
            <h1>Taxi Car Service</h1>
            <p>Pre-book premium rides · USA only</p>
          </div>
        </div>
        <nav className={styles.nav}>
          <a href="#book">Book</a>
          <a href="#services">Services</a>
        </nav>
      </header>

      {pendingApproval && (
        <div className={styles.etaBanner}>
          <div>
            <strong>ETA Update — confirmation required</strong>
            <p>
              Traffic changed your ETA. Locked fare: {formatUSD(pendingApproval.lockedFare)}.
              Approve to keep your ride on the platform.
            </p>
          </div>
          <div className={styles.etaActions}>
            <button className={styles.btnApprove} onClick={() => handleEtaApproval(true)}>Approve</button>
            <button className={styles.btnDecline} onClick={() => handleEtaApproval(false)}>Cancel ride</button>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <section className={styles.hero} id="book">
          <div className={styles.heroContent}>
            <span className={styles.badge}>Pre-book · Live ETA · Locked fares</span>
            <h2>Ride in style.<br />Book ahead.</h2>
            <p>Choose Econom, Lux, or Lux SUV. We lock your fare at booking and confirm traffic 10 minutes before pickup.</p>
          </div>

          <div className={styles.bookingCard}>
            {step === 'book' && (
              <>
                <h3>Book your ride</h3>

                <div className={styles.categories}>
                  {(Object.entries(SERVICE_CATEGORIES) as [ServiceCategory, typeof SERVICE_CATEGORIES.econom][]).map(
                    ([key, cat]) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.categoryBtn} ${category === key ? styles.categoryActive : ''}`}
                        style={{ '--cat-accent': cat.accent } as React.CSSProperties}
                        onClick={() => setCategory(key)}
                      >
                        <span className={styles.catLabel}>{cat.label}</span>
                        <span className={styles.catDesc}>{cat.description}</span>
                        <span className={styles.catRate}>From {formatUSD(cat.baseFare)}</span>
                      </button>
                    )
                  )}
                </div>

                <div className={styles.field}>
                  <label>Pickup (USA address)</label>
                  <div className={styles.inputRow}>
                    <input
                      value={pickupText}
                      onChange={(e) => setPickupText(e.target.value)}
                      onBlur={() => geocodeField(pickupText, 'pickup')}
                      placeholder="123 Main St, New York, NY"
                    />
                    <button type="button" onClick={() => detectLocation('pickup')} title="Use my location">📍</button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Dropoff</label>
                  <div className={styles.inputRow}>
                    <input
                      value={dropoffText}
                      onChange={(e) => setDropoffText(e.target.value)}
                      onBlur={() => geocodeField(dropoffText, 'dropoff')}
                      placeholder="JFK Airport, Queens, NY"
                    />
                    <button type="button" onClick={() => detectLocation('dropoff')} title="Use my location">📍</button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Scheduled pickup</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label>Payment method</label>
                  <select value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value as PaymentProvider)}>
                    <option value="stripe">Stripe (Card)</option>
                    <option value="tabapay">Tabapay (Bank / Card)</option>
                    <option value="currencycloud">CurrencyCloud (International)</option>
                  </select>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.btnPrimary} onClick={getQuote} disabled={loading}>
                  {loading ? 'Calculating…' : 'Get live quote'}
                </button>
              </>
            )}

            {step === 'confirm' && quote && (
              <>
                <h3>Confirm your ride</h3>
                <div className={styles.quoteBox}>
                  <div className={styles.quoteRow}>
                    <span>Distance</span>
                    <span>{quote.route.distanceMiles} mi</span>
                  </div>
                  <div className={styles.quoteRow}>
                    <span>ETA (traffic)</span>
                    <span>{Math.round(quote.route.durationInTrafficMinutes ?? quote.route.durationMinutes)} min</span>
                  </div>
                  <div className={styles.quoteRow}>
                    <span>Base fare</span>
                    <span>{formatUSD(quote.fare.baseFare)}</span>
                  </div>
                  <div className={styles.quoteRow}>
                    <span>Mileage</span>
                    <span>{formatUSD(quote.fare.mileageCharge)}</span>
                  </div>
                  <div className={styles.quoteRow}>
                    <span>Time</span>
                    <span>{formatUSD(quote.fare.timeCharge)}</span>
                  </div>
                  <div className={`${styles.quoteRow} ${styles.quoteTotal}`}>
                    <span>Locked fare</span>
                    <span>{formatUSD(quote.fare.total)}</span>
                  </div>
                </div>
                <p className={styles.fareNote}>
                  Fare locked at booking. If ETA changes ≤5 min before pickup, price stays the same.
                  You pay the agreed amount; driver paid on actual route.
                </p>
                <div className={styles.btnRow}>
                  <button className={styles.btnSecondary} onClick={() => setStep('book')}>Back</button>
                  <button className={styles.btnPrimary} onClick={confirmBooking} disabled={loading}>
                    {loading ? 'Processing…' : `Pay with ${paymentProvider}`}
                  </button>
                </div>
              </>
            )}

            {step === 'success' && bookedRide && (
              <div className={styles.success}>
                <div className={styles.successIcon}>✓</div>
                <h3>Ride booked!</h3>
                <p>Your {SERVICE_CATEGORIES[bookedRide.category].label} ride is confirmed.</p>
                <p className={styles.lockedFare}>Locked fare: {formatUSD(bookedRide.lockedFare)}</p>
                <p className={styles.fareNote}>
                  We&apos;ll check traffic 10 min before pickup and send ETA confirmation if needed.
                </p>
                <button className={styles.btnPrimary} onClick={() => { setStep('book'); setQuote(null); }}>
                  Book another ride
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.mapSection}>
          {isLoaded ? (
            <GoogleMap mapContainerStyle={mapContainerStyle} center={pickup ?? USA_CENTER} zoom={pickup ? 12 : 4} options={mapOptions}>
              {pickup && <Marker position={pickup} label="A" />}
              {dropoff && <Marker position={dropoff} label="B" />}
              {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#00d4aa', strokeWeight: 4 } }} />}
            </GoogleMap>
          ) : (
            <div className={styles.mapPlaceholder}>Loading USA map…</div>
          )}
        </section>

        <section className={styles.services} id="services">
          <h2>Service tiers</h2>
          <div className={styles.serviceGrid}>
            {(Object.entries(SERVICE_CATEGORIES) as [ServiceCategory, typeof SERVICE_CATEGORIES.econom][]).map(
              ([key, cat]) => (
                <article key={key} className={styles.serviceCard} style={{ borderColor: cat.accent }}>
                  <h3 style={{ color: cat.accent }}>{cat.label}</h3>
                  <ul>
                    <li>Base: {formatUSD(cat.baseFare)} (first mile)</li>
                    <li>Then: {formatUSD(cat.perMileAfterFirst)}/mile</li>
                    <li>Time: {formatUSD(cat.perMinute)}/min</li>
                  </ul>
                </article>
              )
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 Taxi Car Service · Payments: Stripe · Tabapay · CurrencyCloud</p>
      </footer>
    </div>
  );
}
