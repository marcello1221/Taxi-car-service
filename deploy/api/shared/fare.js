"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_CATEGORIES = void 0;
exports.calculateFare = calculateFare;
exports.getRiderCharge = getRiderCharge;
exports.PAYMENT_FEE_RATES = void 0;
exports.splitRiderPayment = splitRiderPayment;
exports.shouldKeepLockedFare = shouldKeepLockedFare;
exports.round2 = round2;
exports.formatUSD = formatUSD;
exports.SERVICE_CATEGORIES = {
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
function calculateFare(category, route) {
    const rates = exports.SERVICE_CATEGORIES[category];
    const distanceMiles = route.distanceMiles;
    const durationMinutes = route.durationInTrafficMinutes ?? route.durationMinutes;
    const mileageCharge = distanceMiles <= 1
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
function getRiderCharge(lockedFare) {
    return lockedFare;
}
/** Percentages deducted from total rider payment before driver net income. */
exports.PAYMENT_FEE_RATES = {
    companyNet: 0.15,
    cityTax: 0.0878,
    blackCarFund: 0.015,
    nycSurcharge: 0.005,
    govFee: 0.18,
};
/** Split rider payment into company fees, taxes, and driver net income. */
function splitRiderPayment(riderCharge) {
    const charge = round2(riderCharge);
    const companyNetFee = round2(charge * exports.PAYMENT_FEE_RATES.companyNet);
    const cityTax = round2(charge * exports.PAYMENT_FEE_RATES.cityTax);
    const blackCarFund = round2(charge * exports.PAYMENT_FEE_RATES.blackCarFund);
    const nycSurcharge = round2(charge * exports.PAYMENT_FEE_RATES.nycSurcharge);
    const govFee = round2(charge * exports.PAYMENT_FEE_RATES.govFee);
    const driverNet = round2(charge - companyNetFee - cityTax - blackCarFund - nycSurcharge - govFee);
    return {
        riderCharge: charge,
        companyNetFee,
        cityTax,
        blackCarFund,
        nycSurcharge,
        govFee,
        driverNet,
    };
}
/**
 * ETA changed ≤5 min from previous → keep locked fare.
 * >5 min difference → fare may need recalculation (returns false).
 */
function shouldKeepLockedFare(previousEtaMinutes, newEtaMinutes) {
    return Math.abs(newEtaMinutes - previousEtaMinutes) <= 5;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
function formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}
