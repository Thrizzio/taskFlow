# High-Level Design (HLD) - FocusFlow

## System Architecture
FocusFlow uses a standard client-server architecture:
- **Client**: React (Vite, TypeScript, React Router).
- **Server**: Node.js/Express backend providing RESTful APIs.
- **Databases**:
  - MongoDB (Mongoose): Operational data (flexible schema).
  - PostgreSQL (pg): Analytics and reporting (structured schema).
- **External LLM**: Google Gemini API (called from the server; API key stored in `GEMINI_API_KEY` env variable).

## Main Data Flow & Responsibilities
1. **Frontend**: Manages UI state, routing, renders data. Timer state is handled natively in React.
2. **Backend**: Thin controllers, business logic in services/agent, secure authentication checking.
3. **MongoDB**: Stores users, flexible task definitions, and session history.
4. **PostgreSQL**: Stores `users`, `tasks`, and `analytics_sessions` — optimized for reporting.

## Authentication Flow
- User registers/logs in → Server validates → Server issues JWT → Client stores JWT → Client attaches JWT via `Authorization: Bearer <token>` for protected routes.

## Focus-Session Flow
- User selects task → Uses React Timer → User completes session.
- Client POSTs to `/api/focus-sessions`.
- Server creates `FocusSession` doc in MongoDB.
- Server creates `analytics_sessions` row in PostgreSQL in the same backend step.

## Closure-Backed Task Filtering (Client)
- The Tasks page uses `createTaskFilter(statusFilter)` — a closure factory — to filter the task list.
- `createTaskFilter` returns an inner function (`filterTask`) that closes over `statusFilter`.
- A React `useEffect` with dependency array `[tasks, statusFilter]` creates a fresh closure and applies it whenever the filter or the task list changes.
- This keeps the filtering logic encapsulated and makes the closure observable in production React code.

## Multi-Step Productivity Agent

```
Client
  ↓
POST /api/agent/productivity
  ↓
Agent Controller
  ↓
┌────────────────────────────────────────────────┐
│  Stage 1 — Planner                             │
│  Input:  user request (string)                 │
│  Output: Plan { goals[], timeframe? }          │
│  Role:   Determines what data to analyze.      │
└──────────────────┬─────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────┐
│  Stage 2 — Analyzer                            │
│  Input:  Plan + user's FocusSession documents  │
│  Output: AnalysisResult { totalMinutes,        │
│          sessionCount, topTask }               │
│  Role:   Produces structured productivity      │
│          metrics from raw session data.        │
└──────────────────┬─────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────┐
│  Stage 3 — LLM Insight    [External: Gemini]   │
│  Input:  AnalysisResult + user request         │
│  Output: LlmInsight { insight, priority,       │
│          reason, source }                      │
│  Role:   Interprets the metrics using a        │
│          language model to produce a           │
│          structured, reasoned insight.         │
│  Fallback: Returns deterministic insight       │
│  if API key missing or call fails.             │
└──────────────────┬─────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────┐
│  Stage 4 — Recommender                         │
│  Input:  AnalysisResult + LlmInsight           │
│  Output: Recommendation string                 │
│  Role:   Combines raw metrics with the LLM     │
│          insight to produce the final,         │
│          human-readable suggestion.            │
└──────────────────┬─────────────────────────────┘
                   ↓
Response: { plan, analysis, insight, recommendation }
```

### Why the stages are separated
- **Planner**: decouples request interpretation from data retrieval.
- **Analyzer**: decouples metric computation from interpretation (unit-testable in isolation).
- **LLM Insight**: the only stage that calls an external service; isolating it makes fallback/error handling clean and the LLM call easy to explain.
- **Recommender**: decouples output formatting from both data gathering and LLM calls.

### Why this qualifies as multi-step
Each stage has well-defined inputs and outputs; the output of one stage is the **explicit input** to the next. Stage 3 (LLM Insight) adds genuine non-deterministic reasoning. The stages cannot be arbitrarily reordered without breaking the data dependency chain.

## External Systems & Architecture
- **JWT**: Stateless auth validation.
- **Google Gemini API**: External LLM used by Stage 3 of the productivity agent.
- Node.js orchestrates calls to both DBs and the external LLM.

## Deployment Overview
- Designed as a 12-factor app ready for deployment (e.g., Heroku, Render).
- Environment variables must be securely injected, with failure-on-missing checks on boot.
- `GEMINI_API_KEY` is optional at runtime — absence degrades gracefully.

## Docker
The Node/Express server is containerized via `server/Dockerfile`. MongoDB and PostgreSQL remain external services.
