import type { Address } from './types';
export declare const OUTER_BOROS: readonly ["brooklyn", "queens", "bronx", "staten_island"];
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
export declare const NYC_TOLL_AMOUNTS: {
    readonly rfk: 9.11;
    readonly verrazano: 7.46;
    readonly holland: 16.79;
    readonly queensMidtown: 7.46;
    readonly mtaCongestionBelow60: 1.5;
};
export declare const NYC_RIDER_FEE_RATES: {
    readonly companyNet: 0.15;
    readonly cityTax: 0.08875;
    readonly blackCarFund: 0.015;
    readonly nycSurcharge: 0.005;
};
/** Detect NYC borough from geocoded address text and coordinates. */
export declare function detectBorough(lat: number, lng: number, addressText?: string): NYCBorough;
export declare function isManhattanBelow60th(lat: number, lng: number, addressText?: string): boolean;
/** Detect bridge/tunnel tolls for a NYC trip using route geometry when available. */
export declare function detectTripTolls(input: {
    pickup: Address;
    dropoff: Address;
    routePoints?: RoutePoint[];
}): TollCharge[];
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
export declare function calculateTripCharges(input: {
    baseFare: number;
    mileageCharge: number;
    timeCharge: number;
    distanceMiles: number;
    durationMinutes: number;
    pickup: Address;
    dropoff: Address;
    routePoints?: RoutePoint[];
}): TripChargeBreakdown;
