const getEnv = (key, defaultValue = undefined) => {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue;
};

export const config = {
  // Node environment
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: parseInt(getEnv('PORT', '3000'), 10),

  // Database
  DATABASE_URL: getEnv('DATABASE_URL'),

  // JWT Authentication
  JWT_SECRET: getEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Email (SMTP)
  SMTP_HOST: getEnv('SMTP_HOST'),
  SMTP_PORT: parseInt(getEnv('SMTP_PORT', '587'), 10),
  SMTP_USER: getEnv('SMTP_USER'),
  SMTP_PASS: getEnv('SMTP_PASS'),
  SMTP_FROM: getEnv('SMTP_FROM', 'noreply@fitzone.local'),

  // Firebase (Push Notifications)
  FIREBASE_PROJECT_ID: getEnv('FIREBASE_PROJECT_ID'),
  FIREBASE_PRIVATE_KEY: getEnv('FIREBASE_PRIVATE_KEY'),
  FIREBASE_CLIENT_EMAIL: getEnv('FIREBASE_CLIENT_EMAIL'),

  // Vercel Blob (File Storage)
  BLOB_READ_WRITE_TOKEN: getEnv('BLOB_READ_WRITE_TOKEN'),

  // CORS
  FRONTEND_URL: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  ADMIN_FRONTEND_URL: getEnv('ADMIN_FRONTEND_URL', 'http://localhost:3001'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  // Security
  BCRYPT_ROUNDS: parseInt(getEnv('BCRYPT_ROUNDS', '12'), 10),
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,

  // Session
  SESSION_TIMEOUT_MS: parseInt(getEnv('SESSION_TIMEOUT_MS', '86400000'), 10), // 24 hours

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Debug
  DEBUG: getEnv('DEBUG', 'false') === 'true',
};

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// Validate critical env vars on startup
if (!isTest) {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'BLOB_READ_WRITE_TOKEN',
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
}