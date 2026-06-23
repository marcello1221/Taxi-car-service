import { v4 as uuidv4 } from 'uuid';
import {
  calculateFare,
  shouldKeepLockedFare,
  getDriverPayout,
  getRiderCharge,
  type Address,
  type PaymentProvider,
  type Ride,
  type ServiceCategory,
} from '@taxi/shared';
import { createRide, updateRide, getRideById, listRides, getRidesNeedingEtaCheck } from '../db';
import { getRouteInfo } from './maps';
import { createPaymentIntent, capturePayment } from './payments';

export async function quoteRide(
  category: ServiceCategory,
  pickup: Address,
  dropoff: Address,
  scheduledAt: string
) {
  const departure = new Date(scheduledAt);
  const route = await getRouteInfo(pickup, dropoff, departure);
  const fare = calculateFare(category, route);
  return { route, fare, category };
}

export async function bookRide(input: {
  userId: string;
  category: ServiceCategory;
  pickup: Address;
  dropoff: Address;
  scheduledAt: string;
  paymentProvider: PaymentProvider;
}) {
  const { route, fare } = await quoteRide(
    input.category,
    input.pickup,
    input.dropoff,
    input.scheduledAt
  );

  const rideId = uuidv4();
  const payment = await createPaymentIntent(input.paymentProvider, fare.total, {
    rideId,
    userId: input.userId,
  });

  if (!payment.success) {
    throw new Error(payment.error || 'Payment setup failed');
  }

  const ride: Ride = {
    id: rideId,
    userId: input.userId,
    category: input.category,
    pickup: input.pickup,
    dropoff: input.dropoff,
    scheduledAt: input.scheduledAt,
    status: 'confirmed',
    lockedFare: fare.total,
    lockedFareBreakdown: fare,
    currentRoute: route,
    previousEtaMinutes: route.durationInTrafficMinutes ?? route.durationMinutes,
    paymentProvider: input.paymentProvider,
    paymentIntentId: payment.intentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  createRide(ride);
  return { ride, payment };
}

export async function processEtaConfirmation(rideId: string) {
  const ride = getRideById(rideId);
  if (!ride || !ride.currentRoute) return null;

  const route = await getRouteInfo(
    ride.pickup,
    ride.dropoff,
    new Date(ride.scheduledAt)
  );

  const newEta = route.durationInTrafficMinutes ?? route.durationMinutes;
  const previousEta = ride.previousEtaMinutes ?? newEta;
  const keepFare = shouldKeepLockedFare(previousEta, newEta);

  let lockedFare = ride.lockedFare;
  let lockedFareBreakdown = ride.lockedFareBreakdown;

  if (!keepFare) {
    const newFare = calculateFare(ride.category, route);
    lockedFare = newFare.total;
    lockedFareBreakdown = newFare;
  }

  return updateRide(rideId, {
    status: 'awaiting_eta_approval',
    currentRoute: route,
    previousEtaMinutes: previousEta,
    lockedFare,
    lockedFareBreakdown,
    etaConfirmationSentAt: new Date().toISOString(),
    riderApprovedEta: undefined,
  });
}

export function approveEtaUpdate(rideId: string, approved: boolean) {
  const ride = getRideById(rideId);
  if (!ride) return null;

  if (!approved) {
    return updateRide(rideId, {
      status: 'cancelled',
      riderApprovedEta: false,
    });
  }

  return updateRide(rideId, {
    status: 'confirmed',
    riderApprovedEta: true,
  });
}

export function assignDriver(rideId: string, driverId: string) {
  return updateRide(rideId, { driverId, status: 'assigned' });
}

export async function completeRide(rideId: string, actualRoute?: { distanceMiles: number; durationMinutes: number }) {
  const ride = getRideById(rideId);
  if (!ride) return null;

  const route = actualRoute ?? ride.currentRoute ?? {
    distanceMiles: ride.lockedFareBreakdown.distanceMiles,
    durationMinutes: ride.lockedFareBreakdown.durationMinutes,
  };

  const driverPayout = getDriverPayout(ride.category, route);
  const riderCharge = getRiderCharge(ride.lockedFare);

  if (ride.paymentIntentId && ride.paymentProvider) {
    await capturePayment(ride.paymentProvider, ride.paymentIntentId, riderCharge);
  }

  return updateRide(rideId, {
    status: 'completed',
    currentRoute: route,
  });
}

export function getAvailableRidesForDrivers() {
  return listRides({ forDrivers: true });
}

export function getUserRides(userId: string) {
  return listRides({ userId });
}

export async function runEtaConfirmationJob() {
  const rides = getRidesNeedingEtaCheck();
  for (const ride of rides) {
    await processEtaConfirmation(ride.id);
  }
  return rides.length;
}
