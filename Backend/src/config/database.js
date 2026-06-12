import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/index.js';

let prismaInstance;

const getPrismaClient = () => {
  if (prismaInstance) {
    return prismaInstance;
  }

  prismaInstance = new PrismaClient({
    errorFormat: 'pretty',
    log: process.env.DEBUG === 'true'
      ? [
        { emit: 'stdout', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ]
      : [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
  });

  // Event handlers
  prismaInstance.$on('error', (e) => {
    logger.error('Prisma Error Event', e);
  });

  prismaInstance.$on('warn', (e) => {
    logger.warn('Prisma Warning Event', e);
  });

  return prismaInstance;
};

export const prisma = getPrismaClient();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Disconnecting Prisma...');
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Disconnecting Prisma...');
  await prisma.$disconnect();
});

// Health check function
export const checkDatabaseConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', error);
    return false;
  }
};