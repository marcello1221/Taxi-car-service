'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import {
  SERVICE_CATEGORIES,
  ACCEPTED_CARD_TYPES,
  formatUSD,
  type ServiceCategory,
  type Address,
  type CardType,
  type Ride,
  type User,
} from '@taxi/shared';
import AddressAutocomplete from './AddressAutocomplete';
import TripChargePanel from './TripChargePanel';
import styles from '../app/page.module.css';

const BookingMap = dynamic(() => import('./BookingMap'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const AUTH_KEY = 'taxi_rider_session';
const DEFAULT_LOCATION_BIAS = { lat: 40.7128, lng: -74.006 };

type Quote = {
  route: { distanceMiles: number; durationMinutes: number; durationInTrafficMinutes?: number };
  fare: {
    total: number;
    baseFare: number;
    mileageCharge: number;
    timeCharge: number;
    subtotal?: number;
    tolls?: Array<{ id: string; name: string; amount: number }>;
    tollTotal?: number;
    companyNetFee?: number;
    cityTax?: number;
    blackCarFund?: number;
    nycSurcharge?: number;
    pickupBorough?: string;
    dropoffBorough?: string;
  };
};

type AuthMode = 'signup' | 'login';

export default function BookingApp() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY,
    libraries: ['places'],
  });

  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [step, setStep] = useState<'book' | 'confirm' | 'success'>('book');
  const [category, setCategory] = useState<ServiceCategory>('econom');
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickup, setPickup] = useState<Address | null>(null);
  const [dropoff, setDropoff] = useState<Address | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [cardType, setCardType] = useState<CardType>('visa');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [liveQuote, setLiveQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookedRide, setBookedRide] = useState<Ride | null>(null);
  const [pendingApproval, setPendingApproval] = useState<Ride | null>(null);
  const [nearbyBias, setNearbyBias] = useState(DEFAULT_LOCATION_BIAS);

  useEffect(() => {
    const minDate = new Date(Date.now() + 15 * 60000);
    setScheduledAt(minDate.toISOString().slice(0, 16));
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch { /* ignore */ }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setNearbyBias({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* keep NYC default */ },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/rides/user/${user.id}`);
        const rides: Ride[] = await res.json();
        const pending = rides.find((r) => r.status === 'awaiting_eta_approval');
        if (pending) setPendingApproval(pending);
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user || !pickup || !dropoff || step !== 'book') {
      setLiveQuote(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/rides/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            pickup,
            dropoff,
            scheduledAt: new Date(scheduledAt).toISOString(),
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setLiveQuote(data);
          setError('');
        }
      } catch {
        if (!cancelled) setLiveQuote(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, pickup, dropoff, category, scheduledAt, step]);

  const persistUser = (next: User | null) => {
    setUser(next);
    if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_KEY);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    if (authForm.password !== authForm.confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authForm.name,
          email: authForm.email,
          phone: authForm.phone,
          password: authForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign up failed');
      persistUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email.trim(), password: authForm.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      persistUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = useCallback(async (target: 'pickup' | 'dropoff') => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setNearbyBias({ lat, lng });

      let addr: Address = { formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
      try {
        const res = await fetch(`${API_URL}/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (res.ok) {
          addr = { formatted: data.formatted, lat: data.lat, lng: data.lng };
        }
      } catch { /* keep coordinates */ }

      if (target === 'pickup') {
        setPickup(addr);
        setPickupText(addr.formatted);
      } else {
        setDropoff(addr);
        setDropoffText(addr.formatted);
      }
      setError('');
    }, () => setError('Location permission denied'));
  }, []);

  const geocodeText = useCallback(async (text: string): Promise<Address | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(',').map((part) => Number(part.trim()));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return { formatted: trimmed, lat: parts[0], lng: parts[1] };
    }

    try {
      const res = await fetch(`${API_URL}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) return null;
      return { formatted: data.formatted, lat: data.lat, lng: data.lng };
    } catch {
      return null;
    }
  }, []);

  const resolveAddressField = useCallback(
    async (
      text: string,
      current: Address | null,
      setText: (value: string) => void,
      setAddr: (value: Address | null) => void
    ): Promise<Address | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      if (current && current.formatted.trim() === trimmed) return current;

      const resolved = await geocodeText(trimmed);
      if (resolved) {
        setAddr(resolved);
        setText(resolved.formatted);
      }
      return resolved;
    },
    [geocodeText]
  );

  const geocodeField = async (text: string, target: 'pickup' | 'dropoff') => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const setText = target === 'pickup' ? setPickupText : setDropoffText;
      const setAddr = target === 'pickup' ? setPickup : setDropoff;
      const current = target === 'pickup' ? pickup : dropoff;
      const resolved = await resolveAddressField(text, current, setText, setAddr);
      if (!resolved) {
        setError(`Could not find ${target} address — pick a suggestion or check spelling`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickupTextChange = (text: string) => {
    setPickupText(text);
    if (pickup && text.trim() !== pickup.formatted.trim()) {
      setPickup(null);
    }
  };

  const handleDropoffTextChange = (text: string) => {
    setDropoffText(text);
    if (dropoff && text.trim() !== dropoff.formatted.trim()) {
      setDropoff(null);
    }
  };

  const handlePickupSelect = (addr: Address) => {
    setPickup(addr);
    setPickupText(addr.formatted);
  };

  const handleDropoffSelect = (addr: Address) => {
    setDropoff(addr);
    setDropoffText(addr.formatted);
  };

  const getQuote = async () => {
    if (!user) {
      setError('Please sign up or sign in to book');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resolvedPickup = await resolveAddressField(
        pickupText,
        pickup,
        setPickupText,
        setPickup
      );
      const resolvedDropoff = await resolveAddressField(
        dropoffText,
        dropoff,
        setDropoffText,
        setDropoff
      );
      if (!resolvedPickup || !resolvedDropoff) {
        setError('Set pickup and dropoff addresses — pick from the list or enter a full USA address');
        return;
      }

      if (liveQuote) {
        setQuote(liveQuote);
        setStep('confirm');
        return;
      }

      const res = await fetch(`${API_URL}/api/rides/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          pickup: resolvedPickup,
          dropoff: resolvedDropoff,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
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
    if (!user || !pickup || !dropoff) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rides/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          category,
          pickup,
          dropoff,
          scheduledAt: new Date(scheduledAt).toISOString(),
          cardType,
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

  const cancelBookedRide = async (rideId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel ride');
      setBookedRide(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel ride');
    } finally {
      setLoading(false);
    }
  };

  const cardLabel = ACCEPTED_CARD_TYPES.find((c) => c.id === cardType)?.label ?? 'Card';

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
          {user ? (
            <span className={styles.userChip}>
              {user.name}
              <button type="button" className={styles.signOutBtn} onClick={() => persistUser(null)}>Sign out</button>
            </span>
          ) : (
            <a href="#book">Sign up</a>
          )}
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
        <section className={user && step === 'book' ? styles.tripHero : styles.hero} id="book">
          {user && step === 'book' ? (
            <div className={styles.tripPlanner}>
              <BookingMap center={nearbyBias} pickup={pickup} dropoff={dropoff} />

              <div className={styles.tripTopPanel}>
                <h3>Book your ride</h3>
                <div className={styles.categoriesCompact}>
                  {(Object.entries(SERVICE_CATEGORIES) as [ServiceCategory, typeof SERVICE_CATEGORIES.econom][]).map(
                    ([key, cat]) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.categoryBtn} ${category === key ? styles.categoryActive : ''}`}
                        style={{ '--cat-accent': cat.accent } as React.CSSProperties}
                        onClick={() => setCategory(key)}
                      >
                        {cat.label}
                      </button>
                    )
                  )}
                </div>

                <div className={styles.addressGrid}>
                  <div className={styles.field}>
                    <label>Pickup</label>
                    <div className={styles.inputRow}>
                      <div className={styles.autocompleteWrap}>
                        <AddressAutocomplete
                          id="pickup-address"
                          value={pickupText}
                          onChange={handlePickupTextChange}
                          onSelect={handlePickupSelect}
                          onBlurFallback={(text) => geocodeField(text, 'pickup')}
                          placeholder="Pickup address"
                          isLoaded={isLoaded}
                          locationBias={nearbyBias}
                          inputClassName={styles.addressInput}
                        />
                      </div>
                      <button type="button" onClick={() => detectLocation('pickup')} title="Use my location">📍</button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label>Dropoff</label>
                    <div className={styles.inputRow}>
                      <div className={styles.autocompleteWrap}>
                        <AddressAutocomplete
                          id="dropoff-address"
                          value={dropoffText}
                          onChange={handleDropoffTextChange}
                          onSelect={handleDropoffSelect}
                          onBlurFallback={(text) => geocodeField(text, 'dropoff')}
                          placeholder="Dropoff address"
                          isLoaded={isLoaded}
                          locationBias={nearbyBias}
                          inputClassName={styles.addressInput}
                        />
                      </div>
                      <button type="button" onClick={() => detectLocation('dropoff')} title="Use my location">📍</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.tripBottomPanel}>
                <TripChargePanel
                  fare={liveQuote?.fare ?? null}
                  loading={quoteLoading}
                  distanceMiles={liveQuote?.route.distanceMiles}
                  durationMinutes={
                    liveQuote?.route.durationInTrafficMinutes ?? liveQuote?.route.durationMinutes
                  }
                />

                <div className={styles.tripBottomFields}>
                  <div className={styles.field}>
                    <label>Scheduled pickup</label>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                  </div>

                  <div className={styles.field}>
                    <label>Payment card</label>
                    <div className={styles.cardTypes}>
                      {ACCEPTED_CARD_TYPES.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          className={`${styles.cardTypeBtn} ${cardType === card.id ? styles.cardTypeActive : ''}`}
                          onClick={() => setCardType(card.id)}
                        >
                          {card.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.btnPrimary} onClick={getQuote} disabled={loading || quoteLoading || !liveQuote}>
                  {loading ? 'Calculating…' : 'Continue to payment'}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className={styles.heroContent}>
            <span className={styles.badge}>Pre-book · Live ETA · Locked fares</span>
            <h2>Ride in style.<br />Book ahead.</h2>
            <p>Choose Econom, Lux, or Lux SUV. Sign up to book. We lock your fare at booking and confirm traffic 10 minutes before pickup.</p>
          </div>

          <div className={styles.bookingCard}>
            {!user ? (
              <>
                <h3>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h3>
                <p className={styles.authHint}>Sign up is required to book a ride on our website.</p>
                <div className={styles.authTabs}>
                  <button
                    type="button"
                    className={authMode === 'signup' ? styles.authTabActive : styles.authTab}
                    onClick={() => { setAuthMode('signup'); setError(''); }}
                  >
                    Sign up
                  </button>
                  <button
                    type="button"
                    className={authMode === 'login' ? styles.authTabActive : styles.authTab}
                    onClick={() => { setAuthMode('login'); setError(''); }}
                  >
                    Sign in
                  </button>
                </div>
                {authMode === 'login' && (
                  <p className={styles.authHint}>
                    Demo rider: <strong>rider@taxi.demo</strong> / <strong>Rider123!</strong>
                  </p>
                )}
                {authMode === 'signup' && (
                  <div className={styles.field}>
                    <label>Full name</label>
                    <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Jane Smith" />
                  </div>
                )}
                <div className={styles.field}>
                  <label>Email</label>
                  <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@email.com" />
                </div>
                {authMode === 'signup' && (
                  <div className={styles.field}>
                    <label>Phone</label>
                    <input value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="+1 (555) 123-4567" />
                  </div>
                )}
                <div className={styles.field}>
                  <label>Password</label>
                  <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" />
                </div>
                {authMode === 'signup' && (
                  <div className={styles.field}>
                    <label>Confirm password</label>
                    <input type="password" value={authForm.confirm} onChange={(e) => setAuthForm({ ...authForm, confirm: e.target.value })} />
                  </div>
                )}
                {error && <p className={styles.error}>{error}</p>}
                <button
                  className={styles.btnPrimary}
                  onClick={authMode === 'signup' ? handleSignUp : handleLogin}
                  disabled={loading}
                >
                  {loading ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </>
            ) : step === 'confirm' && quote ? (
              <>
                <h3>Confirm your ride</h3>
                <TripChargePanel
                  fare={quote.fare}
                  distanceMiles={quote.route.distanceMiles}
                  durationMinutes={quote.route.durationInTrafficMinutes ?? quote.route.durationMinutes}
                />
                <div className={styles.quoteBox}>
                  <div className={styles.quoteRow}>
                    <span>Payment</span>
                    <span>{cardLabel}</span>
                  </div>
                </div>
                <p className={styles.fareNote}>
                  Fare locked at booking. If ETA changes ≤5 min before pickup, price stays the same.
                </p>
                <div className={styles.btnRow}>
                  <button className={styles.btnSecondary} onClick={() => setStep('book')}>Back</button>
                  <button className={styles.btnPrimary} onClick={confirmBooking} disabled={loading}>
                    {loading ? 'Processing…' : `Pay with ${cardLabel}`}
                  </button>
                </div>
              </>
            ) : step === 'success' && bookedRide ? (
              <div className={styles.success}>
                <div className={styles.successIcon}>{bookedRide.status === 'cancelled' ? '✕' : '✓'}</div>
                <h3>{bookedRide.status === 'cancelled' ? 'Ride cancelled' : 'Ride booked!'}</h3>
                <p>
                  {bookedRide.status === 'cancelled'
                    ? 'Your booking has been cancelled.'
                    : `Your ${SERVICE_CATEGORIES[bookedRide.category].label} ride is confirmed.`}
                </p>
                {bookedRide.status !== 'cancelled' && (
                  <p className={styles.lockedFare}>Locked fare: {formatUSD(bookedRide.lockedFare)}</p>
                )}
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.btnRow}>
                  {bookedRide.status !== 'cancelled' && (
                    <button
                      className={styles.btnSecondary}
                      onClick={() => void cancelBookedRide(bookedRide.id)}
                      disabled={loading}
                    >
                      {loading ? 'Cancelling…' : 'Cancel ride'}
                    </button>
                  )}
                  <button className={styles.btnPrimary} onClick={() => { setStep('book'); setQuote(null); setBookedRide(null); }}>
                    Book another ride
                  </button>
                </div>
              </div>
            ) : null}
          </div>
            </>
          )}
        </section>

        <section className={styles.services} id="services">
          <h2>Service tiers</h2>
          <div className={styles.serviceGrid}>
            {(Object.entries(SERVICE_CATEGORIES) as [ServiceCategory, typeof SERVICE_CATEGORIES.econom][]).map(
              ([key, cat]) => (
                <article key={key} className={styles.serviceCard} style={{ borderColor: cat.accent }}>
                  <h3 style={{ color: cat.accent }}>{cat.label}</h3>
                  <p className={styles.serviceDesc}>{cat.description}</p>
                </article>
              )
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 Taxi Car Service · Visa · Mastercard · American Express · Debit & Credit Cards</p>
      </footer>
    </div>
  );
}
