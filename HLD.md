# High-Level Design (HLD) - FocusFlow

## System Architecture
FocusFlow uses a standard client-server architecture:
- **Client**: React (Vite, TypeScript, React Router).
- **Server**: Node.js/Express backend providing RESTful APIs.
- **Databases**: 
  - MongoDB (Mongoose): Operational data (flexible schema).
  - PostgreSQL (pg): Analytics and reporting (structured schema).

## Main Data Flow & Responsibilities
1. **Frontend**: Manages UI state, routing, and renders data. Timer state is handled natively in React.
2. **Backend**: Thin controllers, business logic in services, secure authentication checking.
3. **MongoDB**: Stores users, flexible task definitions, and session history.
4. **PostgreSQL**: Stores a subset of structured records—`users`, `tasks`, and `analytics_sessions`—specifically optimized for reporting endpoints.

## Authentication Flow
- User registers/logs in -> Server validates -> Server issues JWT -> Client stores JWT -> Client attaches JWT via `Authorization: Bearer <token>` for protected routes.

## Focus-Session Flow
- User selects task -> Uses React Timer -> User completes session.
- Client POSTs to `/api/focus-sessions`.
- Server creates `FocusSession` doc in MongoDB.
- Server creates `analytics_sessions` row in PostgreSQL in the exact same backend service step.

## External Systems & Architecture
- **JWT**: For statutory stateless auth validation.
- Node.js functions as the orchestrator to both DBs.

## Deployment Overview
- Designed as a 12-factor app ready for deployment (e.g. Heroku, Render).
- Environment variables must be securely injected, with failure-on-missing checks on boot.
