import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { SERVICE_CATEGORIES } from '@taxi/shared';
import { seedDemoData, getRideById } from './db';
import { seedDemoUsers, DEMO_CREDENTIALS } from './services/demoUsers';
import { errorMessage } from './utils/errors';
import {
  quoteRide,
  bookRide,
  approveEtaUpdate,
  assignDriver,
  completeRide,
  getAvailableRidesForDrivers,
  getUserRides,
  runEtaConfirmationJob,
} from './services/rides';
import { geocodeAddress, autocompleteAddress, getPlaceDetails } from './services/maps';
import { registerRider, authenticateRider, getUserById } from './services/auth';
import { loginStaff, addStaffMember, getStaffList, changeStaffRole, removeStaffMember } from './services/staff';
import { buildBusinessReport, addExpense, getDriversOverview } from './services/reports';
import { staffAuth, requirePermission } from './middleware/staffAuth';

dotenv.config({ path: '../../.env' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production';
      callback(null, allowed);
    },
    credentials: true,
  })
);
app.use(express.json());

seedDemoData();
seedDemoUsers();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Taxi Car Service API' });
});

app.get('/api/categories', (_req, res) => {
  res.json(SERVICE_CATEGORIES);
});

app.post('/api/auth/signup', (req, res) => {
  try {
    const user = registerRider(req.body);
    res.status(201).json(user);
  } catch (err) {
    const message = errorMessage(err);
    res.status(message.includes('already exists') ? 409 : 400).json({ error: message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    seedDemoUsers();
    const { email, password } = req.body as { email: string; password: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const user = authenticateRider(email, password);
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: errorMessage(err) });
  }
});

app.get('/api/auth/me/:userId', (req, res) => {
  const user = getUserById(req.params.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

app.post('/api/auth/demo', (_req, res) => {
  seedDemoUsers();
  const rider = DEMO_CREDENTIALS.find((d) => d.role === 'Rider');
  res.json({
    message: 'Use POST /api/auth/login with email and password',
    demo: rider ? { email: rider.email, password: rider.password } : null,
  });
});

app.post('/api/geocode', async (req, res) => {
  const { address } = req.body as { address: string };
  const result = await geocodeAddress(address);
  if (!result) {
    res.status(404).json({ error: 'Address not found (USA only)' });
    return;
  }
  res.json(result);
});

app.get('/api/places/autocomplete', async (req, res) => {
  const input = String(req.query.input || '');
  const suggestions = await autocompleteAddress(input);
  res.json(suggestions);
});

app.get('/api/places/details', async (req, res) => {
  const placeId = String(req.query.placeId || '');
  const result = await getPlaceDetails(placeId);
  if (!result) {
    res.status(404).json({ error: 'Place not found' });
    return;
  }
  res.json(result);
});

app.post('/api/rides/quote', async (req, res) => {
  try {
    const { category, pickup, dropoff, scheduledAt } = req.body;
    const quote = await quoteRide(category, pickup, dropoff, scheduledAt);
    res.json(quote);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.post('/api/rides/book', async (req, res) => {
  try {
    const result = await bookRide(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.get('/api/rides/user/:userId', (req, res) => {
  res.json(getUserRides(req.params.userId));
});

app.get('/api/rides/available', (_req, res) => {
  res.json(getAvailableRidesForDrivers());
});

app.get('/api/rides/:id', (req, res) => {
  const ride = getRideById(req.params.id);
  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return;
  }
  res.json(ride);
});

app.post('/api/rides/:id/eta-approval', (req, res) => {
  const { approved } = req.body as { approved: boolean };
  const ride = approveEtaUpdate(req.params.id, approved);
  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return;
  }
  res.json(ride);
});

app.post('/api/rides/:id/assign', (req, res) => {
  const { driverId } = req.body as { driverId: string };
  const ride = assignDriver(req.params.id, driverId);
  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return;
  }
  res.json(ride);
});

app.post('/api/rides/:id/complete', async (req, res) => {
  const ride = await completeRide(req.params.id, req.body?.actualRoute);
  if (!ride) {
    res.status(404).json({ error: 'Ride not found' });
    return;
  }
  res.json(ride);
});

/* ── Owner platform ── */
app.post('/api/owner/auth/login', (req, res) => {
  try {
    seedDemoUsers();
    const { email, password } = req.body as { email: string; password: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const staff = loginStaff(email, password);
    res.json(staff);
  } catch (err) {
    res.status(401).json({ error: errorMessage(err) });
  }
});

app.get('/api/owner/staff', staffAuth, requirePermission('manage_staff'), (req, res) => {
  try {
    const staff = (req as express.Request & { staff: import('@taxi/shared').StaffMember }).staff;
    res.json(getStaffList(staff));
  } catch (err) {
    res.status(403).json({ error: String(err) });
  }
});

app.post('/api/owner/staff', staffAuth, requirePermission('manage_staff'), (req, res) => {
  try {
    const staff = (req as express.Request & { staff: import('@taxi/shared').StaffMember }).staff;
    const created = addStaffMember(staff, req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.patch('/api/owner/staff/:id/role', staffAuth, requirePermission('manage_staff'), (req, res) => {
  try {
    const staff = (req as express.Request & { staff: import('@taxi/shared').StaffMember }).staff;
    const updated = changeStaffRole(staff, String(req.params.id), req.body.role);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.delete('/api/owner/staff/:id', staffAuth, requirePermission('manage_staff'), (req, res) => {
  try {
    const staff = (req as express.Request & { staff: import('@taxi/shared').StaffMember }).staff;
    const updated = removeStaffMember(staff, String(req.params.id));
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.get('/api/owner/reports/:period', staffAuth, requirePermission('view_reports'), (req, res) => {
  const period = req.params.period as 'weekly' | 'monthly';
  if (period !== 'weekly' && period !== 'monthly') {
    res.status(400).json({ error: 'Period must be weekly or monthly' });
    return;
  }
  const refDate = req.query.date as string | undefined;
  res.json(buildBusinessReport(period, refDate));
});

app.post('/api/owner/expenses', staffAuth, requirePermission('manage_expenses'), (req, res) => {
  try {
    const staff = (req as express.Request & { staff: import('@taxi/shared').StaffMember }).staff;
    const expense = addExpense(staff, req.body);
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.get('/api/owner/drivers', staffAuth, requirePermission('view_drivers'), (_req, res) => {
  res.json(getDriversOverview());
});

cron.schedule('* * * * *', async () => {
  if (process.env.VERCEL) return;
  const count = await runEtaConfirmationJob();
  if (count > 0) console.log(`ETA confirmations sent: ${count}`);
});

app.get('/internal/cron/eta', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const count = await runEtaConfirmationJob();
  res.json({ processed: count });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚕 Taxi API running on http://localhost:${PORT}`);
  });
}
