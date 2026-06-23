export type ServiceCategory = 'econom' | 'lux' | 'lux_suv';
export type RideStatus = 'pending' | 'confirmed' | 'awaiting_eta_approval' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentProvider = 'stripe';
export type CardType = 'visa' | 'mastercard' | 'amex' | 'debit' | 'credit';
export interface Coordinates {
    lat: number;
    lng: number;
}
export interface Address {
    formatted: string;
    lat: number;
    lng: number;
    placeId?: string;
}
export interface FareBreakdown {
    baseFare: number;
    mileageCharge: number;
    timeCharge: number;
    total: number;
    distanceMiles: number;
    durationMinutes: number;
}
export interface RouteInfo {
    distanceMiles: number;
    durationMinutes: number;
    durationInTrafficMinutes?: number;
}
export interface Ride {
    id: string;
    userId: string;
    driverId?: string;
    category: ServiceCategory;
    pickup: Address;
    dropoff: Address;
    scheduledAt: string;
    status: RideStatus;
    lockedFare: number;
    lockedFareBreakdown: FareBreakdown;
    currentRoute?: RouteInfo;
    previousEtaMinutes?: number;
    etaConfirmationSentAt?: string;
    riderApprovedEta?: boolean;
    paymentProvider?: PaymentProvider;
    paymentIntentId?: string;
    riderCharge?: number;
    driverPayout?: number;
    platformNet?: number;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: 'rider' | 'driver';
}
export interface Driver extends User {
    role: 'driver';
    vehicleCategory: ServiceCategory;
    isAvailable: boolean;
    rating: number;
}
