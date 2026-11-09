# Gym Backend Architecture

## Overview

The backend follows a layered MVC architecture with strict separation of responsibilities.

The goal is to keep business logic centralized, controllers thin, validation reusable, and future growth manageable.

---

## Layers

### Controllers

Responsibilities:

* Receive HTTP requests
* Validate request flow
* Call services
* Return responses

Controllers must not contain business logic.

---

### Services

Responsibilities:

* Business rules
* Database operations
* Cross-module coordination
* Calculations
* Permission-sensitive decisions

All business logic belongs here.

---

### Validators

Responsibilities:

* Input validation
* Payload normalization
* Request schema enforcement

Implemented using Zod.

---

### Middlewares

Responsibilities:

* Authentication
* Authorization
* Error handling
* Rate limiting

Shared request concerns live here.

---

### Prisma

Responsibilities:

* Database access
* Migrations
* Relations
* Queries

PostgreSQL is accessed exclusively through Prisma.

---

### Jobs

Responsibilities:

* Scheduled processes
* Point calculations
* Analytics generation
* Wrapped generation
* Complaint processing
* Automatic recommendations

Jobs are executed through Vercel Cron.

---

### Realtime

Responsibilities:

* Presence updates
* Assistance events
* Social challenge events
* Generic notifications

Implemented using Ably.

---

## Core Principles

### Separation of Concerns

Every layer has a single responsibility.

### Scalability

Features should be extendable without major refactors.

### Simplicity

Avoid unnecessary abstractions.

### Maintainability

Code should be understandable by new developers.

### Testability

Business logic should remain isolated from transport layers.

---

## User Roles

### ADMIN

Full platform management.

### TRAINER

Assistance, routines and user follow-up.

### USER

Standard application usage.

---

## Global Rules

### Points

Points are generated exclusively by the system.

Users cannot manually:

* add points
* remove points
* edit points

Administrative reviews may correct system-generated results.

### Deactivated Accounts

Accounts are never physically deleted.

The account:

* remains in the database
* preserves history
* preserves progress
* preserves statistics

Access is restricted through the isActive field.

### Trainer Notes

Visible only to:

* creator trainer
* administrators

Not visible to:

* users
* other trainers

### Medical Conditions

Visible only to:

* owner
* trainers
* administrators

### Objectives

Visible only to:

* owner
* trainers
* administrators

---

## Admin / trainer screens

* **Live updates (Ably).** `realtime/ably.js` exposes one channel, `staff:live`, that only trainers and admins can
  *subscribe* to (`GET /staff/ably-token`). Services call `signalStaff(topic)` (`realtime/staffSignal.js`) when
  something changes (`help`, `people`, `conflicts`, `routines`, `reports`). The message carries no personal data: the
  apps answer by re-reading their own list. Without `ABLY_API_KEY` nothing is published and the apps fall back to a slow
  refresh. The app side is `Frontend/realtime/staffRealtime.js` + `Frontend/hooks/useLiveLoad.js`.
* **Activity log.** `ActivityLog` (insert-only) records what admins/trainers do; the admin "Historial" merges it with the
  members' `HistorialEvento` rows (members who withdrew analytics consent are left out).
* **Reports.** `report.service.js` reviews `Complaint` and `Denuncia` together (accept = progressive penalty,
  reject, escalate, remove). Strikes are shared by both kinds.
* **Routine proposals.** `RoutineRequest` goes PENDING -> ACCEPTED (trainer took it) -> PROPOSED (sent) ->
  COMPLETED (member accepted: saved as a per-account `GeneralRoutine` + added to that day) / DECLINED.
* **Language.** The app sends `Accept-Language: es|en`; `locales/errors.js` translates error messages and
  `locales/notifications.js` writes the notifications of these features in the language stored in `User.language`
  (`PATCH /users/me/language`).
