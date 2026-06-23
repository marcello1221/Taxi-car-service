import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Ride, User, Driver, ServiceCategory } from '@taxi/shared';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/taxi.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK(role IN ('rider', 'driver'))
  );

  CREATE TABLE IF NOT EXISTS drivers (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    vehicle_category TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    rating REAL DEFAULT 5.0
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export function seedDemoData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (count.c > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, name, phone, role) VALUES (?, ?, ?, ?, ?)'
  );
  insertUser.run('user-demo', 'rider@taxi.demo', 'Alex Rider', '+1-555-0100', 'rider');
  insertUser.run('driver-demo', 'driver@taxi.demo', 'Jordan Driver', '+1-555-0200', 'driver');
  db.prepare(
    'INSERT INTO drivers (user_id, vehicle_category, is_available, rating) VALUES (?, ?, ?, ?)'
  ).run('driver-demo', 'econom', 1, 4.9);
}

export function getOrCreateUser(email: string, name: string, role: 'rider' | 'driver'): User {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, string> | undefined;
  if (existing) return rowToUser(existing);

  const id = role === 'driver' ? `driver-${Date.now()}` : `user-${Date.now()}`;
  db.prepare('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)').run(id, email, name, role);
  if (role === 'driver') {
    db.prepare('INSERT INTO drivers (user_id, vehicle_category) VALUES (?, ?)').run(id, 'econom');
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
      payment_provider, payment_intent_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ride.id, ride.userId, ride.driverId ?? null, ride.category,
    JSON.stringify(ride.pickup), JSON.stringify(ride.dropoff),
    ride.scheduledAt, ride.status, ride.lockedFare,
    JSON.stringify(ride.lockedFareBreakdown),
    ride.currentRoute ? JSON.stringify(ride.currentRoute) : null,
    ride.previousEtaMinutes ?? null,
    ride.paymentProvider ?? null, ride.paymentIntentId ?? null,
    ride.createdAt, ride.updatedAt
  );
  return ride;
}

export function updateRide(id: string, patch: Partial<Ride>): Ride | null {
  const existing = getRideById(id);
  if (!existing) return null;

  const updated: Ride = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE rides SET
      driver_id = ?, status = ?, locked_fare = ?, locked_fare_breakdown_json = ?,
      current_route_json = ?, previous_eta_minutes = ?, eta_confirmation_sent_at = ?,
      rider_approved_eta = ?, payment_provider = ?, payment_intent_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.driverId ?? null, updated.status, updated.lockedFare,
    JSON.stringify(updated.lockedFareBreakdown),
    updated.currentRoute ? JSON.stringify(updated.currentRoute) : null,
    updated.previousEtaMinutes ?? null,
    updated.etaConfirmationSentAt ?? null,
    updated.riderApprovedEta ? 1 : updated.riderApprovedEta === false ? 0 : null,
    updated.paymentProvider ?? null, updated.paymentIntentId ?? null,
    updated.updatedAt, id
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

  if (filters?.userId) {
    sql += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.forDrivers) {
    sql += " AND status IN ('confirmed', 'pending') AND driver_id IS NULL";
  }

  sql += ' ORDER BY scheduled_at ASC';
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToRide);
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export { db };
