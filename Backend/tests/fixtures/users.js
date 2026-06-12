import bcrypt from 'bcrypt';

const hashedPassword = bcrypt.hashSync('TestPassword123!', 12);

export const adminUser = {
  id: 'user-admin-001',
  email: 'admin@test.local',
  username: 'admin_test',
  password: hashedPassword,
  fullName: 'Admin Test User',
  role: 'ADMIN',
  emailVerified: true,
  profileComplete: true,
  accountPaused: false,
  tokenVersion: 0,
};

export const trainerUser = {
  id: 'user-trainer-001',
  email: 'trainer@test.local',
  username: 'trainer_test',
  password: hashedPassword,
  fullName: 'Trainer Test User',
  role: 'TRAINER',
  emailVerified: true,
  profileComplete: true,
  accountPaused: false,
  tokenVersion: 0,
  specialties: ['strength', 'cardio'],
};

export const regularUser = {
  id: 'user-regular-001',
  email: 'user@test.local',
  username: 'user_test',
  password: hashedPassword,
  fullName: 'Regular Test User',
  role: 'USER',
  emailVerified: true,
  profileComplete: true,
  accountPaused: false,
  tokenVersion: 0,
};

export const unverifiedUser = {
  id: 'user-unverified-001',
  email: 'unverified@test.local',
  username: 'unverified_test',
  password: hashedPassword,
  fullName: 'Unverified Test User',
  role: 'USER',
  emailVerified: false,
  profileComplete: false,
  accountPaused: false,
  tokenVersion: 0,
};

export const pausedUser = {
  id: 'user-paused-001',
  email: 'paused@test.local',
  username: 'paused_test',
  password: hashedPassword,
  fullName: 'Paused Test User',
  role: 'USER',
  emailVerified: true,
  profileComplete: true,
  accountPaused: true,
  pauseReason: 'Test pause',
  tokenVersion: 0,
};

export const createUserPayload = {
  email: 'newuser@test.local',
  username: 'newuser_test',
  password: 'TestPassword123!',
  fullName: 'New Test User',
};

export const updateProfilePayload = {
  fullName: 'Updated Name',
  age: 30,
  weight: 75,
  height: 180,
  fitnessLevel: 'intermediate',
  goals: ['strength', 'muscle_gain'],
};

export const updateSettingsPayload = {
  theme: 'dark',
  language: 'es',
  notifications: true,
  allowChallenges: false,
};

export const createUserProfile = {
  age: 28,
  weight: 82,
  height: 185,
  fitnessLevel: 'advanced',
  goals: ['strength', 'muscle_gain'],
};

export const createUserPoints = {
  totalPoints: 500,
  currentPoints: 450,
};