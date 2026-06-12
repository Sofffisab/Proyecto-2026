# GYM Backend - Architecture Documentation

## Overview

This is a Node.js + Express + Prisma backend for a gym member retention application. The architecture follows MVC pattern with clear separation of concerns.

## Key Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Type Safety**: Zod validation on all inputs
3. **Security First**: JWT tokens, bcrypt hashing, rate limiting, CORS
4. **Modularity**: New features don't touch existing code
5. **Scalability**: Transaction support, indexed queries, efficient caching

## Folder Structure
src/
├── config/          # Configuration (env, database connection)
├── utils/           # Utilities (jwt, password, email, qr, helpers, formatters)
├── middlewares/     # Express middlewares (auth, validation, error handling)
├── validators/      # Zod schemas for validation
├── services/        # Business logic (where real work happens)
├── controllers/     # HTTP request handlers (orchestrate services)
├── routes/          # Route definitions
├── sockets/         # WebSocket handlers
├── jobs/            # Cron jobs and scheduled tasks
├── types/           # TypeScript types and error definitions
└── lib/             # Internal libraries (cache, etc)


## Data Flow

1. **Request** → Express Router
2. **Validation** → Middleware + Zod Schema
3. **Authentication** → JWT Token Check
4. **Authorization** → Role-based Access Control
5. **Business Logic** → Service Layer
6. **Database** → Prisma ORM
7. **Response** → Formatted JSON

## Database Schema

### User Model
- Core user data: email, password, role
- Profile: age, weight, height, goals
- Settings: notifications, privacy, preferences
- Points: gamification tracking

### Progress Tracking
- ProgressUpdate: exercise logs, status approval
- PersonalBest: track max weight/reps per exercise
- WeightLog: historical weight tracking

### Social Features
- SocialInteraction: follow/like/message between users
- Challenge: fitness challenges between users
- Blocked: block users from interaction

### Assistance
- HelpRequest: users request trainer help
- TrainerAnnotation: trainer notes on users
- Complaint: moderation system for inappropriate behavior

### Gamification
- Routine: exercise routines (default or custom)
- Reward: redeemable items/services
- RewardClaim: user reward redemptions

### Machines & Check-in
- Machine: gym equipment
- MachineUsage: track machine usage by users
- CheckIn: user attendance tracking
- QRCode: QR codes for machines and check-in

## Authentication Flow

1. **Register** → Hash password, create user, send verification email
2. **Verify Email** → Token validation, set emailVerified = true
3. **Login** → Verify password, generate JWT + refresh token
4. **Authenticated Requests** → Bearer token in Authorization header
5. **Token Refresh** → Use refresh token to get new access token
6. **Logout** → Increment tokenVersion (invalidates all tokens)

## Authorization

- **Role-based**: USER, TRAINER, ADMIN with hierarchy
- **Resource-based**: Users can only access their own data
- **Admin-only**: System configuration, complaint review, rewards
- **Trainer-only**: User profiles, progress verification, routines

## Error Handling

- Try-catch in all async functions
- Centralized error handler middleware
- Specific error codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, etc)
- Detailed logging for debugging

## Security Features

- **Password**: Bcrypt hashing with 12 rounds
- **JWT**: Versioned tokens (invalidate on logout/reset)
- **Rate Limiting**: 100 requests per 15 minutes
- **CORS**: Whitelist frontend URLs
- **Helmet**: Security headers
- **Input Validation**: Zod schemas on all inputs
- **SQL Injection**: Parameterized queries via Prisma

## Testing

- **Unit Tests**: Service layer logic
- **Integration Tests**: API endpoints with database
- **Fixtures**: Sample data for testing

Run tests: `npm run test`

## Deployment

- Environment variables in .env
- Database migrations: `npx prisma migrate deploy`
- Seed data: `npx prisma db seed`
- Start production: `NODE_ENV=production npm start`

## Performance Optimization

- Database indexes on frequently queried fields
- Pagination for list endpoints (default 20, max 100 items)
- Transaction support for multi-step operations
- Efficient Prisma queries (select only needed fields)

## Monitoring

- Structured JSON logging
- Error logs in `/logs/error.log`
- Debug mode: `DEBUG=true` in .env
- Request/response timing via logger

## Future Enhancements

- WebSocket real-time notifications
- Caching layer (Redis)
- Bulk email sending
- Advanced analytics dashboard
- Mobile app integration
- Stripe integration for premium features