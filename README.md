# Taxi Car Service

Pre-book taxi platform for the USA — user website, rider app, and driver app with live Google Maps ETA, locked fares, and multi-provider payments.

## Architecture

```
taxi-car-service/
├── apps/
│   ├── api/              # Express REST API + SQLite + cron ETA jobs
│   ├── web/              # Next.js rider website
│   ├── mobile-user/      # Expo rider app
│   └── mobile-driver/    # Expo driver app
└── packages/
    └── shared/           # Fare logic, types, service tiers
```

## Service Tiers & Pricing

| Tier | Base (≤1 mi) | Per mile after | Per minute |
|------|-------------|----------------|------------|
| **Econom** | $10 | $2.00 | $0.60 |
| **Lux** | $15 | $2.80 | $0.80 |
| **Lux SUV** | $20 | $3.80 | $1.00 |

## Fare Logic

1. **At booking** — Google Maps Distance Matrix returns live ETA; fare is calculated and **locked**.
2. **10 min before pickup** — Cron re-checks traffic; rider gets ETA confirmation prompt.
3. **ETA change ≤5 min** — Locked fare is kept.
4. **ETA change >5 min** — Fare recalculated; rider must approve to keep the ride.
5. **At completion** — Rider pays the **agreed locked fare**. Driver payout uses **actual** base + mile + minute (shorter route = lower driver pay, rider still pays locked amount).

## Payments

Integrated providers (configure in `.env`):

- **Stripe** — card payments via Payment Intents
- **Tabapay** — bank/card pull transactions
- **CurrencyCloud** — international USD payments

Demo mode works without API keys (mock intent IDs).

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Add GOOGLE_MAPS_API_KEY, payment keys

# Build shared package
npm run build --workspace=@taxi/shared

# Terminal 1 — API (port 4000)
npm run dev:api

# Terminal 2 — Web (port 3000)
npm run dev:web

# Mobile apps
npm run dev:user-app
npm run dev:driver-app
```

## Google Maps Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable: Maps JavaScript API, Distance Matrix API, Geocoding API
3. Restrict API key to **United States** and your domains
4. Set `GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | Service tier definitions |
| POST | `/api/rides/quote` | Live fare quote |
| POST | `/api/rides/book` | Book + payment setup |
| GET | `/api/rides/available` | Pre-book rides for drivers |
| POST | `/api/rides/:id/assign` | Driver accepts ride |
| POST | `/api/rides/:id/eta-approval` | Rider approves ETA update |
| POST | `/api/rides/:id/complete` | Complete ride |

## Demo Accounts

- Rider: `user-demo` / `rider@taxi.demo`
- Driver: `driver-demo` / `driver@taxi.demo`

## License

Private — Taxi Car Service © 2026
