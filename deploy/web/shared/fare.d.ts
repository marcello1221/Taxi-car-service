import type { FareBreakdown, RouteInfo, ServiceCategory } from './types';
export interface CategoryRates {
    label: string;
    baseFare: number;
    perMileAfterFirst: number;
    perMinute: number;
    description: string;
    accent: string;
}
export declare const SERVICE_CATEGORIES: Record<ServiceCategory, CategoryRates>;
/** Calculate fare from distance (miles) and duration (minutes). */
export declare function calculateFare(category: ServiceCategory, route: RouteInfo): FareBreakdown;
/** Rider is charged the originally agreed locked fare. */
export declare function getRiderCharge(lockedFare: number): number;
/** Percentages deducted from total rider payment before driver net income. */
export declare const PAYMENT_FEE_RATES: {
    readonly companyNet: 0.15;
    readonly cityTax: 0.0878;
    readonly blackCarFund: 0.015;
    readonly nycSurcharge: 0.005;
    readonly govFee: 0.18;
};
export interface RiderPaymentSplit {
    riderCharge: number;
    companyNetFee: number;
    cityTax: number;
    blackCarFund: number;
    nycSurcharge: number;
    govFee: number;
    driverNet: number;
}
/** Split rider payment into company fees, taxes, and driver net income. */
export declare function splitRiderPayment(riderCharge: number): RiderPaymentSplit;
/**
 * ETA changed ≤5 min from previous → keep locked fare.
 * >5 min difference → fare may need recalculation (returns false).
 */
export declare function shouldKeepLockedFare(previousEtaMinutes: number, newEtaMinutes: number): boolean;
export declare function round2(n: number): number;
export declare function formatUSD(amount: number): string;
