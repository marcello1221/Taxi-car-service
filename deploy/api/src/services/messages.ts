import type { RideMessage } from '@taxi/shared';
import { createRideMessage, getRideById, listRideMessages } from '../db';

export function getMessagesForRide(rideId: string): RideMessage[] {
  const ride = getRideById(rideId);
  if (!ride) throw new Error('Ride not found');
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

  if (input.senderRole === 'driver') {
    if (ride.driverId && ride.driverId !== input.senderId) {
      throw new Error('Another driver is assigned to this ride');
    }
  } else if (input.senderRole === 'rider') {
    if (ride.userId !== input.senderId) {
      throw new Error('Only the rider can message on this ride');
    }
  }

  return createRideMessage({
    rideId: input.rideId,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body,
  });
}
