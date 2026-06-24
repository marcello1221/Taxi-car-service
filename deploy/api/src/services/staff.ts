import { hashPassword, verifyPassword } from './auth';
import {
  countStaff,
  createStaff,
  getStaffByEmail,
  getStaffById,
  listStaff,
  updateStaffRole,
  deactivateStaff,
} from '../db';
import type { StaffMember, StaffRole } from '@taxi/shared';
import { STAFF_ROLES_CREATABLE_BY_OWNER } from '@taxi/shared';

export function seedOwnerAccount() {
  if (countStaff() > 0) return;

  const email = (process.env.OWNER_EMAIL || 'owner@taxi.demo').toLowerCase();
  const password = process.env.OWNER_PASSWORD || 'owner1234A';
  createStaff({
    email,
    name: 'Platform Owner',
    role: 'owner',
    passwordHash: hashPassword(password),
    createdBy: 'system',
  });
  console.log(`Owner account seeded: ${email}`);
}

export function loginStaff(email: string, password: string): StaffMember {
  const row = getStaffByEmail(email.toLowerCase());
  if (!row || !row.isActive || !verifyPassword(password, row.passwordHash)) {
    throw new Error('Invalid email or password');
  }
  const { passwordHash: _, ...staff } = row;
  return staff;
}

export function addStaffMember(
  actor: StaffMember,
  input: { email: string; name: string; role: StaffRole; password: string }
): StaffMember {
  if (actor.role !== 'owner') throw new Error('Only the owner can add staff');
  if (!STAFF_ROLES_CREATABLE_BY_OWNER.includes(input.role)) {
    throw new Error('Invalid role for new staff member');
  }
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters');

  return createStaff({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: hashPassword(input.password),
    createdBy: actor.id,
  });
}

export function getStaffList(actor: StaffMember): StaffMember[] {
  if (actor.role !== 'owner') throw new Error('Only the owner can view staff list');
  return listStaff();
}

export function changeStaffRole(actor: StaffMember, staffId: string, role: StaffRole): StaffMember {
  if (actor.role !== 'owner') throw new Error('Only the owner can change roles');
  if (role === 'owner') throw new Error('Cannot assign owner role');
  const target = getStaffById(staffId);
  if (!target) throw new Error('Staff member not found');
  if (target.role === 'owner') throw new Error('Cannot change owner role');
  const updated = updateStaffRole(staffId, role);
  if (!updated) throw new Error('Update failed');
  return updated;
}

export function removeStaffMember(actor: StaffMember, staffId: string): StaffMember {
  if (actor.role !== 'owner') throw new Error('Only the owner can deactivate staff');
  const target = getStaffById(staffId);
  if (!target) throw new Error('Staff member not found');
  if (target.role === 'owner') throw new Error('Cannot deactivate owner');
  const updated = deactivateStaff(staffId);
  if (!updated) throw new Error('Deactivation failed');
  return updated;
}

export { getStaffById };
