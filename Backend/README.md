# Backend — Setup Guide

## Requirements

- Node.js 18+
- PostgreSQL (or a Neon connection string)
- A `.env` file based on `.env.example`

## Installation

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` — PostgreSQL connection string (Neon or local Postgres).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — secrets used to sign access and refresh tokens.
- `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` — token lifetimes (defaults: `15m` / `7d`).
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis credentials, used for caching.
- `CRON_SECRET` — shared secret required to trigger the scheduled jobs endpoints.
- `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins (`*` for all).
- `ABLY_API_KEY` — Ably credentials for realtime events.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — Gmail SMTP credentials for transactional email (app password from myaccount.google.com/apppasswords, requires 2-step verification enabled on the account).
- `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` — Firebase Admin credentials, used for push notifications.
- `FRONTEND_URL` — base URL of the frontend app, used to build links in emails.

## Database setup

Run migrations against your database:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

(Optional) Seed the database with sample data:

```bash
npm run prisma:seed
```

## Running the server

Start the development server (with hot reload):

```bash
npm run dev
```

Or start it in production mode:

```bash
npm start
```

By default the server listens on the port configured in `PORT` (3000 if not set).

## Tests

This project uses [Vitest](https://vitest.dev/):

```bash
npm test           # run once
npm run test:watch # watch mode
npm run test:coverage
npm run test:ui
```
