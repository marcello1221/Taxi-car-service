import crypto from 'crypto';
import { signUpUser, loginUser, getUserById } from '../db';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

export function registerRider(input: { email: string; name: string; phone?: string; password: string }) {
  if (!input.email?.trim() || !input.name?.trim() || !input.password) {
    throw new Error('Name, email, and password are required');
  }
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return signUpUser({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: input.phone?.trim(),
    passwordHash: hashPassword(input.password),
  });
}

export function authenticateRider(email: string, password: string) {
  const user = loginUser(email.trim().toLowerCase(), password, verifyPassword);
  if (!user) throw new Error('Invalid email or password');
  return user;
}

export { getUserById };
