# Product Requirements Document (PRD) - FocusFlow

## Problem Statement
Students need a simple, distraction-free tool to track tasks, manage timed focus sessions, and review productivity data without artificial complexity.

## Target User
Students and developers who want a straightforward productivity tracker to build focused work habits.

## Goals
- Provide easy task recording.
- Provide a timer for focus sessions.
- Provide clear analytics on time spent.
- Maintain a clean codebase to demonstrate technical concepts.

## Non-Goals
- Social features, complex AI, payments, real-time collaboration, push notifications.

## User Stories
1. As a student, I want to sign up and log in securely.
2. As a student, I want to create, edit, and complete tasks.
3. As a student, I want to select a task and run a timer session (start/pause/resume/complete).
4. As a student, I want to view my time spent per task on an analytics dashboard.

## MVP Scope & Functional Requirements
- **Authentication:** Registration, login, validation. JWT based.
- **Task Management:** CRUD operations on task items.
- **Focus Timer:** Timer UI with core states (Idle, Running, Paused, Completed).
- **Session Tracking:** Persist sessions and duration upon completion.
- **Analytics:** Dashboard showing time-per-task utilizing PostgreSQL for data shaping.
- **Language Concepts:** Dedicated route `/javascript-concepts` for technical demonstrations.

## Technical-Rubric Mapping
1. **Environment Variables**: `.env` and `config.ts` loading and validation.
2. **Git Workflow**: Conventional commits per feature phase.
3. **Client-side Routing**: React Router with protected routes and dynamic params (`/tasks/:taskId`).
4. **JS - async/await**: APIs, database controllers.
5. **JS - Closures**: `timerClosure.ts` purely as a conceptual demonstration utility.
6. **JS - Event Loop**: Demo page (`EventLoopDemo.tsx`).
7. **JS - Hoisting**: Demo page (`HoistingDemo.tsx`).
8. **JS - Promises vs Callbacks**: Demo utility `promisesVsCallbacks.ts`.
9. **Mongo Schema Modeling**: Used for operational app data (`users`, `tasks`, `focus_sessions`).
10. **SQL JOINs**: PostgreSQL `analytics_sessions` joined with `users` and `tasks` for analytical reporting without duplicating the whole DB context.
