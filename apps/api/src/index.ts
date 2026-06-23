import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { SERVICE_CATEGORIES } from '@taxi/shared';
import { seedDemoData, getRideById } from './db';
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
import { geocodeAddress } from './services/maps';
import { getOrCreateUser } from './db';

dotenv.config({ path: '../../.env' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

seedDemoData();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Taxi Car Service API' });
});

app.get('/api/categories', (_req, res) => {
  res.json(SERVICE_CATEGORIES);
});

app.post('/api/auth/demo', (req, res) => {
  const { email, name, role } = req.body as { email: string; name: string; role: 'rider' | 'driver' };
  const user = getOrCreateUser(email || 'demo@taxi.com', name || 'Demo User', role || 'rider');
  res.json(user);
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

cron.schedule('* * * * *', async () => {
  const count = await runEtaConfirmationJob();
  if (count > 0) console.log(`ETA confirmations sent: ${count}`);
});

app.listen(PORT, () => {
  console.log(`🚕 Taxi API running on http://localhost:${PORT}`);
});
