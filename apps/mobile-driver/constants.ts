import Constants from 'expo-constants';

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://taxi-car-service-api.vercel.app';

export const DRIVER_ID = 'driver-demo';
export const DRIVER_NAME = 'Jordan Driver';

export const theme = {
  bg: '#0a0e17',
  surface: '#12182a',
  surfaceAlt: '#1a2238',
  border: 'rgba(255,255,255,0.08)',
  text: '#f0f4ff',
  muted: '#8b95b5',
  accent: '#f59e0b',
  teal: '#00d4aa',
  danger: '#ff6b6b',
  pickup: '#00d4aa',
  dropoff: '#7c3aed',
};

export type TabKey = 'orders' | 'trips';
