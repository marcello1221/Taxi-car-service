import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Ride, User, ServiceCategory, StaffMember, StaffRole, Expense } from '@taxi/shared';

const dbPath = process.env.DATABASE_PATH || (process.env.VERCEL ? '/tmp/taxi.db' : path.join(__dirname, '../data/taxi.db'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL CHECK(role IN ('rider', 'driver'))
  );

  CREATE TABLE IF NOT EXISTS drivers (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    vehicle_category TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    rating REAL DEFAULT 5.0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    driver_id TEXT REFERENCES users(id),
    category TEXT NOT NULL,
    pickup_json TEXT NOT NULL,
    dropoff_json TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL,
    locked_fare REAL NOT NULL,
    locked_fare_breakdown_json TEXT NOT NULL,
    current_route_json TEXT,
    previous_eta_minutes REAL,
    eta_confirmation_sent_at TEXT,
    rider_approved_eta INTEGER,
    payment_provider TEXT,
    payment_intent_id TEXT,
    rider_charge REAL,
    driver_payout REAL,
    platform_net REAL,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS staff_members (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'accountant', 'dispatcher', 'support')),
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const migrations = [
  'ALTER TABLE users ADD COLUMN password_hash TEXT',
  'ALTER TABLE drivers ADD COLUMN created_at TEXT',
  'ALTER TABLE rides ADD COLUMN rider_charge REAL',
  'ALTER TABLE rides ADD COLUMN driver_payout REAL',
  'ALTER TABLE rides ADD COLUMN platform_net REAL',
  'ALTER TABLE rides ADD COLUMN completed_at TEXT',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* exists */ }
}

export function seedDemoData() {
  /* Demo users are seeded via seedDemoUsers() in services/demoUsers.ts */
}

export function getUserByEmail(email: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
    | Record<string, string>
    | undefined;
  return row ? rowToUser(row) : null;
}

export function insertDemoUser(input: {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'rider' | 'driver';
  passwordHash: string;
}): User {
  db.prepare(
    'INSERT INTO users (id, email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    input.id,
    input.email.toLowerCase(),
    input.name,
    input.phone ?? null,
    input.passwordHash,
    input.role
  );
  return { id: input.id, email: input.email.toLowerCase(), name: input.name, phone: input.phone, role: input.role };
}

export function setUserPasswordHash(userId: string, passwordHash: string) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export function ensureDriverProfile(userId: string, vehicleCategory: ServiceCategory = 'econom') {
  const existing = db.prepare('SELECT user_id FROM drivers WHERE user_id = ?').get(userId);
  if (existing) return;
  db.prepare(
    'INSERT INTO drivers (user_id, vehicle_category, is_available, rating, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, vehicleCategory, 1, 4.9, new Date().toISOString());
}

export function getUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, string> | undefined;
  return row ? rowToUser(row) : null;
}

export function signUpUser(input: {
  email: string;
  name: string;
  phone?: string;
  passwordHash: string;
}): User {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
  if (existing) throw new Error('An account with this email already exists');

  const id = `user-${Date.now()}`;
  db.prepare(
    'INSERT INTO users (id, email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.email, input.name, input.phone ?? null, input.passwordHash, 'rider');
  return { id, email: input.email, name: input.name, phone: input.phone, role: 'rider' };
}

export function loginUser(
  email: string,
  password: string,
  verify: (password: string, hash: string) => boolean
): User | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
    | Record<string, string>
    | undefined;
  if (!row?.password_hash || !verify(password, row.password_hash)) return null;
  return rowToUser(row);
}

export function getOrCreateUser(email: string, name: string, role: 'rider' | 'driver'): User {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, string> | undefined;
  if (existing) return rowToUser(existing);

  const id = role === 'driver' ? `driver-${Date.now()}` : `user-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(id, email, name, role);
  if (role === 'driver') {
    db.prepare(
      'INSERT INTO drivers (user_id, vehicle_category, created_at) VALUES (?, ?, ?)'
    ).run(id, 'econom', now);
  }
  return { id, email, name, role };
}

function rowToUser(row: Record<string, string>): User {
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role as 'rider' | 'driver' };
}

export function createRide(ride: Ride): Ride {
  db.prepare(`
    INSERT INTO rides (
      id, user_id, driver_id, category, pickup_json, dropoff_json, scheduled_at, status,
      locked_fare, locked_fare_breakdown_json, current_route_json, previous_eta_minutes,
      payment_provider, payment_intent_id, rider_charge, driver_payout, platform_net,
      completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ride.id, ride.userId, ride.driverId ?? null, ride.category,
    JSON.stringify(ride.pickup), JSON.stringify(ride.dropoff),
    ride.scheduledAt, ride.status, ride.lockedFare,
    JSON.stringify(ride.lockedFareBreakdown),
    ride.currentRoute ? JSON.stringify(ride.currentRoute) : null,
    ride.previousEtaMinutes ?? null,
    ride.paymentProvider ?? null, ride.paymentIntentId ?? null,
    ride.riderCharge ?? null, ride.driverPayout ?? null, ride.platformNet ?? null,
    ride.completedAt ?? null, ride.createdAt, ride.updatedAt
  );
  return ride;
}

export function updateRide(id: string, patch: Partial<Ride>): Ride | null {
  const existing = getRideById(id);
  if (!existing) return null;

  const updated: Ride = { ...existing, ...patch, updatedAt: new Date().toISOString() };

  db.prepare(`
    UPDATE rides SET
      driver_id = ?, status = ?, locked_fare = ?, locked_fare_breakdown_json = ?,
      current_route_json = ?, previous_eta_minutes = ?, eta_confirmation_sent_at = ?,
      rider_approved_eta = ?, payment_provider = ?, payment_intent_id = ?,
      rider_charge = ?, driver_payout = ?, platform_net = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.driverId ?? null, updated.status, updated.lockedFare,
    JSON.stringify(updated.lockedFareBreakdown),
    updated.currentRoute ? JSON.stringify(updated.currentRoute) : null,
    updated.previousEtaMinutes ?? null,
    updated.etaConfirmationSentAt ?? null,
    updated.riderApprovedEta ? 1 : updated.riderApprovedEta === false ? 0 : null,
    updated.paymentProvider ?? null, updated.paymentIntentId ?? null,
    updated.riderCharge ?? null, updated.driverPayout ?? null, updated.platformNet ?? null,
    updated.completedAt ?? null, updated.updatedAt, id
  );
  return updated;
}

export function getRideById(id: string): Ride | null {
  const row = db.prepare('SELECT * FROM rides WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToRide(row) : null;
}

export function listRides(filters?: { userId?: string; status?: string; forDrivers?: boolean }): Ride[] {
  let sql = 'SELECT * FROM rides WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.userId) { sql += ' AND user_id = ?'; params.push(filters.userId); }
  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters?.forDrivers) {
    sql += " AND status IN ('confirmed', 'pending') AND driver_id IS NULL";
  }

  sql += ' ORDER BY scheduled_at ASC';
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToRide);
}

export function listCompletedRidesInRange(start: string, end: string): Ride[] {
  const rows = db.prepare(`
    SELECT * FROM rides
    WHERE status = 'completed'
      AND completed_at >= ? AND completed_at <= ?
    ORDER BY completed_at DESC
  `).all(start, end) as Record<string, unknown>[];
  return rows.map(rowToRide);
}

export function getRidesNeedingEtaCheck(): Ride[] {
  const now = Date.now();
  const rows = db.prepare(`
    SELECT * FROM rides
    WHERE status = 'confirmed'
      AND eta_confirmation_sent_at IS NULL
      AND datetime(scheduled_at) <= datetime('now', '+10 minutes')
      AND datetime(scheduled_at) > datetime('now')
  `).all() as Record<string, unknown>[];

  return rows.map(rowToRide).filter((ride) => {
    const scheduled = new Date(ride.scheduledAt).getTime();
    const minutesUntil = (scheduled - now) / 60000;
    return minutesUntil <= 10 && minutesUntil > 0;
  });
}

function rowToRide(row: Record<string, unknown>): Ride {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    driverId: (row.driver_id as string) || undefined,
    category: row.category as ServiceCategory,
    pickup: JSON.parse(row.pickup_json as string),
    dropoff: JSON.parse(row.dropoff_json as string),
    scheduledAt: row.scheduled_at as string,
    status: row.status as Ride['status'],
    lockedFare: row.locked_fare as number,
    lockedFareBreakdown: JSON.parse(row.locked_fare_breakdown_json as string),
    currentRoute: row.current_route_json ? JSON.parse(row.current_route_json as string) : undefined,
    previousEtaMinutes: row.previous_eta_minutes as number | undefined,
    etaConfirmationSentAt: (row.eta_confirmation_sent_at as string) || undefined,
    riderApprovedEta: row.rider_approved_eta === 1 ? true : row.rider_approved_eta === 0 ? false : undefined,
    paymentProvider: (row.payment_provider as Ride['paymentProvider']) || undefined,
    paymentIntentId: (row.payment_intent_id as string) || undefined,
    riderCharge: row.rider_charge as number | undefined,
    driverPayout: row.driver_payout as number | undefined,
    platformNet: row.platform_net as number | undefined,
    completedAt: (row.completed_at as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/* ── Staff ── */

function rowToStaff(row: Record<string, unknown>): StaffMember {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as StaffRole,
    isActive: row.is_active === 1,
    createdAt: row.created_at as string,
    createdBy: (row.created_by as string) || undefined,
  };
}

export function getStaffById(id: string): StaffMember | null {
  const row = db.prepare('SELECT * FROM staff_members WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToStaff(row) : null;
}

export function getStaffByEmail(email: string): (StaffMember & { passwordHash: string }) | null {
  const row = db.prepare('SELECT * FROM staff_members WHERE email = ?').get(email.toLowerCase()) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return { ...rowToStaff(row), passwordHash: row.password_hash as string };
}

export function listStaff(): StaffMember[] {
  return (db.prepare('SELECT * FROM staff_members ORDER BY created_at DESC').all() as Record<string, unknown>[])
    .map(rowToStaff);
}

export function createStaff(input: {
  email: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
  createdBy: string;
}): StaffMember {
  const existing = db.prepare('SELECT id FROM staff_members WHERE email = ?').get(input.email.toLowerCase());
  if (existing) throw new Error('Staff email already exists');

  const id = `staff-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO staff_members (id, email, name, role, password_hash, is_active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, input.email.toLowerCase(), input.name, input.role, input.passwordHash, input.createdBy, now);
  return getStaffById(id)!;
}

export function setStaffPasswordHash(staffId: string, passwordHash: string) {
  db.prepare('UPDATE staff_members SET password_hash = ? WHERE id = ?').run(passwordHash, staffId);
}

export function updateStaffRole(id: string, role: StaffRole): StaffMember | null {
  db.prepare('UPDATE staff_members SET role = ? WHERE id = ?').run(role, id);
  return getStaffById(id);
}

export function deactivateStaff(id: string): StaffMember | null {
  db.prepare('UPDATE staff_members SET is_active = 0 WHERE id = ?').run(id);
  return getStaffById(id);
}

export function countStaff(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM staff_members').get() as { c: number }).c;
}

/* ── Expenses ── */

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    category: row.category as string,
    description: row.description as string,
    amount: row.amount as number,
    date: row.date as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

export function listExpensesInRange(start: string, end: string): Expense[] {
  return (db.prepare(`
    SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC
  `).all(start, end) as Record<string, unknown>[]).map(rowToExpense);
}

export function createExpense(input: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const id = `exp-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO expenses (id, category, description, amount, date, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.category, input.description, input.amount, input.date, input.createdBy, now);
  return { ...input, id, createdAt: now };
}

/* ── Drivers stats ── */

export function countDrivers(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM drivers').get() as { c: number }).c;
}

export function countNewDriversInRange(start: string, end: string): number {
  return (db.prepare(`
    SELECT COUNT(*) as c FROM drivers WHERE created_at >= ? AND created_at <= ?
  `).get(start, end) as { c: number }).c;
}

export function listDriversWithUsers(): Array<{
  driverId: string;
  name: string;
  email: string;
  createdAt: string;
  vehicleCategory: string;
  rating: number;
}> {
  return db.prepare(`
    SELECT d.user_id as driverId, u.name, u.email, d.created_at as createdAt,
           d.vehicle_category as vehicleCategory, d.rating
    FROM drivers d JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
  `).all() as Array<{
    driverId: string;
    name: string;
    email: string;
    createdAt: string;
    vehicleCategory: string;
    rating: number;
  }>;
}

export { db };
