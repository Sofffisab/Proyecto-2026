// src/api/config.js
//
// Base URL of the backend API. The Backend mounts its router both at
// "/api/v1" and at root (see Backend/src/server.js), so "/api/v1" is used
// here as the canonical prefix.
//
// Override at runtime with the EXPO_PUBLIC_API_URL env var (Expo exposes
// any EXPO_PUBLIC_* env var to the client bundle automatically), e.g.:
//   EXPO_PUBLIC_API_URL=https://my-backend.vercel.app expo start
//
// Falls back to localhost for local development against `npm run dev` on
// the Backend (see Backend/.env.example -> PORT, default 3000).
const DEFAULT_LOCAL_API_URL = 'http://localhost:3000/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_LOCAL_API_URL;
