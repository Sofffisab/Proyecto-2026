import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  messaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue('mock-token'),
  })),
}));

// Mock Vercel Blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://example.com/mock.jpg' }),
  del: jest.fn().mockResolvedValue({}),
}));

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs in tests (optional)
global.console.log = jest.fn();
global.console.debug = jest.fn();