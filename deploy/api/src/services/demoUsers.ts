import type { StaffRole } from '@taxi/shared';
import { hashPassword } from './auth';
import {
  createStaff,
  ensureDriverProfile,
  getStaffByEmail,
  getUserByEmail,
  insertDemoUser,
  setStaffPasswordHash,
  setUserPasswordHash,
} from '../db';

export interface DemoCredential {
  role: string;
  email: string;
  password: string;
  portal: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  { role: 'Rider', email: 'rider@taxi.demo', password: 'Rider123!', portal: 'User website (book rides)' },
  { role: 'Driver', email: 'driver@taxi.demo', password: 'Driver123!', portal: 'G63 Driver app' },
  { role: 'Owner', email: 'owner@taxi.demo', password: 'owner1234A', portal: 'Owner portal (:3001)' },
  { role: 'Admin', email: 'admin@taxi.demo', password: 'Admin123!', portal: 'Owner portal (:3001)' },
  { role: 'Accountant', email: 'accountant@taxi.demo', password: 'Accountant123!', portal: 'Owner portal (:3001)' },
  { role: 'Dispatcher', email: 'dispatcher@taxi.demo', password: 'Dispatcher123!', portal: 'Owner portal (:3001)' },
  { role: 'Support', email: 'support@taxi.demo', password: 'Support123!', portal: 'Owner portal (:3001)' },
];

const STAFF_DEMO: { email: string; name: string; role: StaffRole; password: string }[] = [
  { email: 'owner@taxi.demo', name: 'Platform Owner', role: 'owner', password: process.env.OWNER_PASSWORD || 'owner1234A' },
  { email: 'admin@taxi.demo', name: 'Demo Admin', role: 'admin', password: 'Admin123!' },
  { email: 'accountant@taxi.demo', name: 'Demo Accountant', role: 'accountant', password: 'Accountant123!' },
  { email: 'dispatcher@taxi.demo', name: 'Demo Dispatcher', role: 'dispatcher', password: 'Dispatcher123!' },
  { email: 'support@taxi.demo', name: 'Demo Support', role: 'support', password: 'Support123!' },
];

function ensureDemoRider() {
  const email = 'rider@taxi.demo';
  const password = 'Rider123!';
  const hash = hashPassword(password);
  const existing = getUserByEmail(email);
  if (existing) {
    setUserPasswordHash(existing.id, hash);
    return;
  }
  insertDemoUser({
    id: 'user-demo',
    email,
    name: 'Alex Rider',
    phone: '+1-555-0100',
    role: 'rider',
    passwordHash: hash,
  });
}

function ensureDemoDriver() {
  const email = 'driver@taxi.demo';
  const password = 'Driver123!';
  const hash = hashPassword(password);
  const existing = getUserByEmail(email);
  if (existing) {
    setUserPasswordHash(existing.id, hash);
    ensureDriverProfile(existing.id, 'lux_suv');
    return;
  }
  insertDemoUser({
    id: 'driver-demo',
    email,
    name: 'Jordan Driver',
    phone: '+1-555-0200',
    role: 'driver',
    passwordHash: hash,
  });
  ensureDriverProfile('driver-demo', 'lux_suv');
}

function ensureDemoStaff() {
  for (const account of STAFF_DEMO) {
    const email = account.email.toLowerCase();
    const hash = hashPassword(account.password);
    const existing = getStaffByEmail(email);
    if (existing) {
      if (account.role === 'owner') {
        setStaffPasswordHash(existing.id, hash);
      }
      continue;
    }
    createStaff({
      email,
      name: account.name,
      role: account.role,
      passwordHash: hash,
      createdBy: 'system',
    });
  }
}

export function seedDemoUsers() {
  ensureDemoRider();
  ensureDemoDriver();
  ensureDemoStaff();
  console.log('Demo users ready (see DEMO_CREDENTIALS in services/demoUsers.ts)');
}
