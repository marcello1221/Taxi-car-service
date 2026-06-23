import type { FareBreakdown, RouteInfo, ServiceCategory } from './types';

export interface CategoryRates {
  label: string;
  baseFare: number;
  perMileAfterFirst: number;
  perMinute: number;
  description: string;
  accent: string;
}

export const SERVICE_CATEGORIES: Record<ServiceCategory, CategoryRates> = {
  econom: {
    label: 'Econom',
    baseFare: 10,
    perMileAfterFirst: 2,
    perMinute: 0.6,
    description: 'Affordable everyday rides',
    accent: '#00D4AA',
  },
  lux: {
    label: 'Lux',
    baseFare: 15,
    perMileAfterFirst: 2.8,
    perMinute: 0.8,
    description: 'Premium comfort & style',
    accent: '#7C3AED',
  },
  lux_suv: {
    label: 'Lux SUV',
    baseFare: 20,
    perMileAfterFirst: 3.8,
    perMinute: 1,
    description: 'Spacious luxury for groups',
    accent: '#F59E0B',
  },
};

/** Calculate fare from distance (miles) and duration (minutes). */
export function calculateFare(
  category: ServiceCategory,
  route: RouteInfo
): FareBreakdown {
  const rates = SERVICE_CATEGORIES[category];
  const distanceMiles = route.distanceMiles;
  const durationMinutes =
    route.durationInTrafficMinutes ?? route.durationMinutes;

  const mileageCharge =
    distanceMiles <= 1
      ? 0
      : (distanceMiles - 1) * rates.perMileAfterFirst;

  const timeCharge = durationMinutes * rates.perMinute;

  const total = rates.baseFare + mileageCharge + timeCharge;

  return {
    baseFare: rates.baseFare,
    mileageCharge: round2(mileageCharge),
    timeCharge: round2(timeCharge),
    total: round2(total),
    distanceMiles: round2(distanceMiles),
    durationMinutes: round2(durationMinutes),
  };
}

/** Rider is charged the originally agreed locked fare. */
export function getRiderCharge(lockedFare: number): number {
  return lockedFare;
}

/** Driver payout uses actual route base + mile + minute (may be less if shorter route). */
export function getDriverPayout(
  category: ServiceCategory,
  actualRoute: RouteInfo
): FareBreakdown {
  return calculateFare(category, actualRoute);
}

/**
 * ETA changed ≤5 min from previous → keep locked fare.
 * >5 min difference → fare may need recalculation (returns false).
 */
export function shouldKeepLockedFare(
  previousEtaMinutes: number,
  newEtaMinutes: number
): boolean {
  return Math.abs(newEtaMinutes - previousEtaMinutes) <= 5;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
