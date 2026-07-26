// tests/helpers/testAuth.js
//
// Real accounts in this app are admin-created only — POST /auth/register
// was intentionally removed (see the comment above the auth routes in
// src/routes/index.js; accounts now come from POST /auth/users, which
// emails a "set your password" link instead of accepting one directly).
//
// E2E suites still need a fast, direct way to get a logged-in user of a
// given role without driving the full admin-create + email + set-password
// flow for every single test. This seeds the user straight into the
// (mocked) Prisma store with a real bcrypt hash, then logs in for real via
// POST /auth/login so the returned tokens are genuine, signed tokens the
// rest of each test can use exactly like before.
//
// IMPORTANT: pass the SAME (mocked) prisma instance the test file already
// resolved via `const prisma = (await import('../../src/config/prisma.js')).default;`
// — that's what makes the created user visible to that test file's copy
// of the in-memory store.

import request from 'supertest';
import bcrypt from 'bcrypt';

export const DEFAULT_TEST_PASSWORD = 'SecurePassword123!';

/**
 * @param {import('http').Server} server
 * @param {*} prisma - the test file's mocked prisma instance
 * @param {object} [overrides]
 * @param {string} [overrides.email]
 * @param {string} [overrides.password]
 * @param {string} [overrides.firstName]
 * @param {string} [overrides.lastName]
 * @param {'USER'|'TRAINER'|'ADMIN'} [overrides.role]
 * @returns {Promise<{ user: object, userId: string, accessToken: string, refreshToken: string }>}
 */
export async function createUserAndLogin(server, prisma, overrides = {}) {
  const {
    email = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password = DEFAULT_TEST_PASSWORD,
    firstName = 'Test',
    lastName = 'User',
    role = 'USER',
    ...rest
  } = overrides;

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role, ...rest },
  });

  const loginRes = await request(server).post('/auth/login').send({ email, password });

  return {
    user: loginRes.body?.data?.user ?? created,
    userId: created.id,
    accessToken: loginRes.body?.data?.accessToken,
    refreshToken: loginRes.body?.data?.refreshToken,
  };
}
