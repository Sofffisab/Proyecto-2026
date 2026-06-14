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
