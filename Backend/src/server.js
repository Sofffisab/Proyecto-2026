import express from 'express';
import helmet from 'helmet';
import { corsConfig, errorHandler, notFoundHandler, asyncHandler } from './middlewares/index.js';
import { logger, config } from './utils/index.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import socialRoutes from './routes/social.routes.js';
import assistanceRoutes from './routes/assistance.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import machineRoutes from './routes/machine.routes.js';
import qrRoutes from './routes/qr.routes.js';
import trainerRoutes from './routes/trainer.routes.js';
import routineRoutes from './routes/routine.routes.js';
import reportRoutes from './routes/report.routes.js';
import challengeRoutes from './routes/challenge.routes.js';
import complaintRoutes from './routes/complaint.routes.js';

const app = express();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security middleware
app.use(helmet());
app.use(corsConfig);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
}));

// ============================================================================
// API ROUTES
// ============================================================================

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// User routes
app.use('/api/users', userRoutes);

// Gamification routes
app.use('/api/gamification', gamificationRoutes);

// Social routes
app.use('/api/social', socialRoutes);

// Assistance routes
app.use('/api/assistance', assistanceRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Machine routes
app.use('/api/machines', machineRoutes);

// QR routes
app.use('/api/qr', qrRoutes);

// Trainer routes
app.use('/api/trainers', trainerRoutes);

// Routine routes
app.use('/api/routines', routineRoutes);

// Report routes
app.use('/api/reports', reportRoutes);

// Challenge routes
app.use('/api/challenges', challengeRoutes);

// Complaint routes
app.use('/api/complaints', complaintRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;