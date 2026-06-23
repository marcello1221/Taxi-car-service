export type StaffRole = 'owner' | 'admin' | 'accountant' | 'dispatcher' | 'support';
export type ReportPeriod = 'weekly' | 'monthly';
export interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
    isActive: boolean;
    createdAt: string;
    createdBy?: string;
}
export interface Expense {
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    createdBy: string;
    createdAt: string;
}
export interface DriverReportRow {
    driverId: string;
    driverName: string;
    email: string;
    ridesCompleted: number;
    revenue: number;
    driverPayout: number;
    platformNet: number;
}
export interface PaymentFeeSummary {
    companyNetFee: number;
    cityTax: number;
    blackCarFund: number;
    nycSurcharge: number;
    govFee: number;
}
export interface BusinessReport {
    period: ReportPeriod;
    startDate: string;
    endDate: string;
    summary: {
        revenue: number;
        fees: PaymentFeeSummary;
        driverPayouts: number;
        expenses: number;
        /** Company net fee (15%) minus operating expenses */
        platformNet: number;
        completedRides: number;
        newDrivers: number;
        totalDrivers: number;
    };
    driverBreakdown: DriverReportRow[];
    expenses: Expense[];
}
export declare const STAFF_ROLE_LABELS: Record<StaffRole, string>;
export declare const STAFF_ROLES_CREATABLE_BY_OWNER: StaffRole[];
export declare const PERMISSIONS: {
    manage_staff: StaffRole[];
    manage_expenses: StaffRole[];
    view_reports: StaffRole[];
    view_drivers: StaffRole[];
    view_rides: StaffRole[];
};
export declare function hasPermission(role: StaffRole, permission: keyof typeof PERMISSIONS): boolean;
