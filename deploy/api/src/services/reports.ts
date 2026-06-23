import type { BusinessReport, ReportPeriod, Expense, PaymentFeeSummary } from '@taxi/shared';
import { splitRiderPayment } from '@taxi/shared';
import {
  listCompletedRidesInRange,
  listExpensesInRange,
  countDrivers,
  countNewDriversInRange,
  listDriversWithUsers,
  createExpense,
  getUserById,
} from '../db';
import type { StaffMember } from '@taxi/shared';

function getDateRange(period: ReportPeriod, refDate = new Date()): { start: string; end: string } {
  const end = new Date(refDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(refDate);
  if (period === 'weekly') {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);

  return { start: start.toISOString(), end: end.toISOString() };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function buildBusinessReport(period: ReportPeriod, refDate?: string): BusinessReport {
  const { start, end } = getDateRange(period, refDate ? new Date(refDate) : new Date());
  const rides = listCompletedRidesInRange(start, end);
  const expenses = listExpensesInRange(start, end);

  const driverMap = new Map<string, {
    driverId: string;
    driverName: string;
    email: string;
    ridesCompleted: number;
    revenue: number;
    driverPayout: number;
    platformNet: number;
  }>();

  let revenue = 0;
  let driverPayouts = 0;
  const fees: PaymentFeeSummary = {
    companyNetFee: 0,
    cityTax: 0,
    blackCarFund: 0,
    nycSurcharge: 0,
    govFee: 0,
  };

  for (const ride of rides) {
    const charge = ride.riderCharge ?? ride.lockedFare;
    const split = splitRiderPayment(charge);
    revenue += split.riderCharge;
    driverPayouts += split.driverNet;
    fees.companyNetFee += split.companyNetFee;
    fees.cityTax += split.cityTax;
    fees.blackCarFund += split.blackCarFund;
    fees.nycSurcharge += split.nycSurcharge;
    fees.govFee += split.govFee;

    if (!ride.driverId) continue;
    const driver = getUserById(ride.driverId);
    const existing = driverMap.get(ride.driverId) ?? {
      driverId: ride.driverId,
      driverName: driver?.name ?? 'Unknown',
      email: driver?.email ?? '',
      ridesCompleted: 0,
      revenue: 0,
      driverPayout: 0,
      platformNet: 0,
    };
    existing.ridesCompleted += 1;
    existing.revenue += split.riderCharge;
    existing.driverPayout += split.driverNet;
    existing.platformNet += split.companyNetFee;
    driverMap.set(ride.driverId, existing);
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    period,
    startDate: start,
    endDate: end,
    summary: {
      revenue: round2(revenue),
      fees: {
        companyNetFee: round2(fees.companyNetFee),
        cityTax: round2(fees.cityTax),
        blackCarFund: round2(fees.blackCarFund),
        nycSurcharge: round2(fees.nycSurcharge),
        govFee: round2(fees.govFee),
      },
      driverPayouts: round2(driverPayouts),
      expenses: round2(totalExpenses),
      platformNet: round2(fees.companyNetFee - totalExpenses),
      completedRides: rides.length,
      newDrivers: countNewDriversInRange(start, end),
      totalDrivers: countDrivers(),
    },
    driverBreakdown: Array.from(driverMap.values())
      .map((d) => ({
        ...d,
        revenue: round2(d.revenue),
        driverPayout: round2(d.driverPayout),
        platformNet: round2(d.platformNet),
      }))
      .sort((a, b) => b.platformNet - a.platformNet),
    expenses,
  };
}

export function addExpense(
  actor: StaffMember,
  input: { category: string; description: string; amount: number; date: string }
): Expense {
  if (input.amount <= 0) throw new Error('Amount must be positive');
  return createExpense({
    category: input.category,
    description: input.description,
    amount: input.amount,
    date: input.date,
    createdBy: actor.id,
  });
}

export function getDriversOverview() {
  return listDriversWithUsers();
}
