import type { Ride, RideMessage } from '@taxi/shared';
import { createRideMessage, getRideById, listRideMessages } from '../db';

const TRIP_CHAT_STATUSES: Ride['status'][] = ['assigned', 'in_progress', 'awaiting_eta_approval'];

function assertTripChatAllowed(ride: Ride, senderRole: 'driver' | 'rider', senderId: string) {
  if (!ride.driverId || !TRIP_CHAT_STATUSES.includes(ride.status)) {
    throw new Error('Chat is only available during an active trip');
  }
  if (senderRole === 'driver') {
    if (ride.driverId !== senderId) {
      throw new Error('Only the assigned driver can chat on this trip');
    }
  } else if (ride.userId !== senderId) {
    throw new Error('Only the rider can chat on this trip');
  }
}

export function getMessagesForRide(rideId: string): RideMessage[] {
  const ride = getRideById(rideId);
  if (!ride) throw new Error('Ride not found');
  if (!ride.driverId || !TRIP_CHAT_STATUSES.includes(ride.status)) {
    throw new Error('Chat is only available during an active trip');
  }
  return listRideMessages(rideId);
}

export function sendRideMessage(input: {
  rideId: string;
  senderId: string;
  senderRole: 'driver' | 'rider';
  body: string;
}): RideMessage {
  const ride = getRideById(input.rideId);
  if (!ride) throw new Error('Ride not found');

  const body = input.body.trim();
  if (!body) throw new Error('Message cannot be empty');

  assertTripChatAllowed(ride, input.senderRole, input.senderId);

  return createRideMessage({
    rideId: input.rideId,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body,
  });
}
