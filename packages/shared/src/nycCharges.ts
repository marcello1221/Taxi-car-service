import type { Address } from './types';
import { round2 } from './fare';

export const OUTER_BOROS = ['brooklyn', 'queens', 'bronx', 'staten_island'] as const;
export type NYCBorough = (typeof OUTER_BOROS)[number] | 'manhattan' | 'other';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface TollCharge {
  id: string;
  name: string;
  amount: number;
}

export const NYC_TOLL_AMOUNTS = {
  rfk: 9.11,
  verrazano: 7.46,
  holland: 16.79,
  queensMidtown: 7.46,
  mtaCongestionBelow60: 1.5,
} as const;

export const NYC_RIDER_FEE_RATES = {
  companyNet: 0.15,
  cityTax: 0.08875,
  blackCarFund: 0.015,
  nycSurcharge: 0.005,
} as const;

const MANHATTAN_60TH_LAT = 40.764;

const TOLL_ZONES: Array<{
  id: keyof typeof NYC_TOLL_AMOUNTS;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}> = [
  { id: 'rfk', name: 'RFK Bridge', lat: 40.783, lng: -73.921, radiusKm: 1.1 },
  { id: 'verrazano', name: 'Verrazzano-Narrows Bridge', lat: 40.606, lng: -74.045, radiusKm: 1.2 },
  { id: 'holland', name: 'Holland Tunnel', lat: 40.726, lng: -74.01, radiusKm: 0.75 },
  { id: 'queensMidtown', name: 'Queens Midtown Tunnel', lat: 40.742, lng: -73.972, radiusKm: 0.75 },
];

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(a: RoutePoint, b: RoutePoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function routeNearPoint(route: RoutePoint[], point: RoutePoint, radiusKm: number): boolean {
  if (route.length === 0) return false;
  return route.some((step) => distanceKm(step, point) <= radiusKm);
}

function boroughFromText(text: string): NYCBorough | null {
  const value = text.toLowerCase();
  if (value.includes('staten island')) return 'staten_island';
  if (value.includes('brooklyn')) return 'brooklyn';
  if (value.includes('queens')) return 'queens';
  if (value.includes('bronx')) return 'bronx';
  if (value.includes('manhattan') || value.includes('new york, ny')) return 'manhattan';
  return null;
}

/** Detect NYC borough from geocoded address text and coordinates. */
export function detectBorough(lat: number, lng: number, addressText = ''): NYCBorough {
  const fromText = boroughFromText(addressText);
  if (fromText) return fromText;

  if (lat >= 40.496 && lat <= 40.651 && lng >= -74.255 && lng <= -74.052) {
    return 'staten_island';
  }

  if (lng >= -74.02 && lng <= -73.907 && lat >= 40.699 && lat <= 40.882) {
    return 'manhattan';
  }

  if (lat >= 40.785 && lat <= 40.917 && lng >= -73.933 && lng <= -73.765) {
    return 'bronx';
  }

  if (lat >= 40.551 && lat <= 40.739 && lng >= -74.042 && lng <= -73.833) {
    return 'brooklyn';
  }

  if (lat >= 40.541 && lat <= 40.8 && lng >= -73.962 && lng <= -73.7) {
    return 'queens';
  }

  return 'other';
}

export function isManhattanBelow60th(lat: number, lng: number, addressText = ''): boolean {
  if (detectBorough(lat, lng, addressText) !== 'manhattan') return false;
  return lat < MANHATTAN_60TH_LAT;
}

function isOuterBoro(borough: NYCBorough): borough is (typeof OUTER_BOROS)[number] {
  return (OUTER_BOROS as readonly string[]).includes(borough);
}

function routeSupportsToll(
  routePoints: RoutePoint[] | undefined,
  zone: (typeof TOLL_ZONES)[number]
): boolean {
  if (!routePoints?.length) return true;
  return routeNearPoint(routePoints, { lat: zone.lat, lng: zone.lng }, zone.radiusKm);
}

/** Detect bridge/tunnel tolls for a NYC trip using route geometry when available. */
export function detectTripTolls(input: {
  pickup: Address;
  dropoff: Address;
  routePoints?: RoutePoint[];
}): TollCharge[] {
  const pickupBorough = detectBorough(input.pickup.lat, input.pickup.lng, input.pickup.formatted);
  const dropoffBorough = detectBorough(input.dropoff.lat, input.dropoff.lng, input.dropoff.formatted);
  const tolls: TollCharge[] = [];
  const seen = new Set<string>();

  const addToll = (id: keyof typeof NYC_TOLL_AMOUNTS, name: string, eligible: boolean) => {
    if (!eligible || seen.has(id)) return;
    const zone = TOLL_ZONES.find((item) => item.id === id);
    if (zone && !routeSupportsToll(input.routePoints, zone)) return;
    seen.add(id);
    tolls.push({ id, name, amount: NYC_TOLL_AMOUNTS[id] });
  };

  const involvesStatenIsland =
    pickupBorough === 'staten_island' || dropoffBorough === 'staten_island';
  const involvesBrooklyn = pickupBorough === 'brooklyn' || dropoffBorough === 'brooklyn';
  const involvesQueens = pickupBorough === 'queens' || dropoffBorough === 'queens';
  const involvesBronx = pickupBorough === 'bronx' || dropoffBorough === 'bronx';
  const involvesManhattan = pickupBorough === 'manhattan' || dropoffBorough === 'manhattan';
  const outerPickup = isOuterBoro(pickupBorough);
  const outerDropoff = isOuterBoro(dropoffBorough);
  const toManhattanFromOuter =
    (outerPickup && dropoffBorough === 'manhattan') ||
    (outerDropoff && pickupBorough === 'manhattan');

  addToll(
    'verrazano',
    'Verrazzano-Narrows Bridge',
    involvesStatenIsland && involvesBrooklyn && pickupBorough !== dropoffBorough
  );

  addToll(
    'rfk',
    'RFK Bridge',
    (involvesBronx && involvesQueens && pickupBorough !== dropoffBorough) ||
      (toManhattanFromOuter && (involvesBronx || involvesQueens))
  );

  if (toManhattanFromOuter) {
    addToll(
      'queensMidtown',
      'Queens Midtown Tunnel',
      involvesQueens && (pickupBorough === 'queens' || dropoffBorough === 'queens')
    );
    addToll(
      'holland',
      'Holland Tunnel',
      involvesBrooklyn && (pickupBorough === 'brooklyn' || dropoffBorough === 'brooklyn')
    );
  }

  if (
    isManhattanBelow60th(input.pickup.lat, input.pickup.lng, input.pickup.formatted) ||
    isManhattanBelow60th(input.dropoff.lat, input.dropoff.lng, input.dropoff.formatted)
  ) {
    addToll('mtaCongestionBelow60', 'MTA Congestion Surcharge (below 60th St)', involvesManhattan);
  }

  return tolls;
}

export interface TripChargeBreakdown {
  baseFare: number;
  mileageCharge: number;
  timeCharge: number;
  subtotal: number;
  tolls: TollCharge[];
  tollTotal: number;
  companyNetFee: number;
  cityTax: number;
  blackCarFund: number;
  nycSurcharge: number;
  total: number;
  distanceMiles: number;
  durationMinutes: number;
  pickupBorough: NYCBorough;
  dropoffBorough: NYCBorough;
}

export function calculateTripCharges(input: {
  baseFare: number;
  mileageCharge: number;
  timeCharge: number;
  distanceMiles: number;
  durationMinutes: number;
  pickup: Address;
  dropoff: Address;
  routePoints?: RoutePoint[];
}): TripChargeBreakdown {
  const subtotal = round2(input.baseFare + input.mileageCharge + input.timeCharge);
  const pickupBorough = detectBorough(input.pickup.lat, input.pickup.lng, input.pickup.formatted);
  const dropoffBorough = detectBorough(input.dropoff.lat, input.dropoff.lng, input.dropoff.formatted);
  const tolls = detectTripTolls({
    pickup: input.pickup,
    dropoff: input.dropoff,
    routePoints: input.routePoints,
  });
  const tollTotal = round2(tolls.reduce((sum, toll) => sum + toll.amount, 0));

  const isNycTrip = pickupBorough !== 'other' || dropoffBorough !== 'other';
  const companyNetFee = isNycTrip ? round2(subtotal * NYC_RIDER_FEE_RATES.companyNet) : 0;
  const cityTax = isNycTrip ? round2(subtotal * NYC_RIDER_FEE_RATES.cityTax) : 0;
  const blackCarFund = isNycTrip ? round2(subtotal * NYC_RIDER_FEE_RATES.blackCarFund) : 0;
  const nycSurcharge = isNycTrip ? round2(subtotal * NYC_RIDER_FEE_RATES.nycSurcharge) : 0;

  const total = round2(
    subtotal + companyNetFee + cityTax + blackCarFund + nycSurcharge + tollTotal
  );

  return {
    baseFare: input.baseFare,
    mileageCharge: input.mileageCharge,
    timeCharge: input.timeCharge,
    subtotal,
    tolls,
    tollTotal,
    companyNetFee,
    cityTax,
    blackCarFund,
    nycSurcharge,
    total,
    distanceMiles: round2(input.distanceMiles),
    durationMinutes: round2(input.durationMinutes),
    pickupBorough,
    dropoffBorough,
  };
}
