import type { Request, Response, NextFunction } from 'express';
import { getStaffById } from '../db';
import { hasPermission, type StaffRole } from '@taxi/shared';

export function staffAuth(req: Request, res: Response, next: NextFunction) {
  const staffId = req.headers['x-staff-id'] as string;
  if (!staffId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const staff = getStaffById(staffId);
  if (!staff || !staff.isActive) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }
  (req as Request & { staff: typeof staff }).staff = staff;
  next();
}

export function requirePermission(permission: Parameters<typeof hasPermission>[1]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const staff = (req as Request & { staff: { role: StaffRole } }).staff;
    if (!hasPermission(staff.role, permission)) {
      res.status(403).json({ error: 'Insufficient privileges' });
      return;
    }
    next();
  };
}
