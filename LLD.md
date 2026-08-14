# Low-Level Design (LLD) - FocusFlow

## Viva / Technical Topic Mapping
| Topic | Implementation Location |
|---|---|
| Environment variables | `.env.example`, `server/src/utils/config.ts` |
| Git workflow | Repository branch structure and commit history |
| Client-side routing | Client `App.tsx` and `TaskDetail.tsx` (using `/:taskId`) |
| async/await | `server/src/controllers/`, `client/src/api/` |
| Closures | `client/src/features/timer/timerClosure.ts` |
| Event loop | `client/src/features/javascript-concepts/EventLoopDemo.tsx` |
| Hoisting | `client/src/features/javascript-concepts/HoistingDemo.tsx` |
| Promises vs callbacks | `client/src/features/javascript-concepts/promisesVsCallbacks.ts` |
| Mongo schema modeling | `server/src/models/User.ts`, `Task.ts`, `FocusSession.ts` |
| SQL JOINs | `server/src/db/queries/analyticsQueries.ts` (`SELECT ... JOIN ...`) |

## New Mapping: Productivity Agent & Docker
| Topic | Implementation |
|---|---|
| Multi-step agent | server/src/agent/productivityAgent.ts |
| Planning step | server/src/agent/planner.ts |
| Analysis step | server/src/agent/analyzer.ts |
| Recommendation step | server/src/agent/recommender.ts |
| Agent API | server/src/controllers/agentController.ts |
| Agent route | server/src/routes/agentRoutes.ts |
| Docker | server/Dockerfile |
| Docker ignore rules | server/.dockerignore |

## Sequence (runtime)
1. Receive `POST /api/agent/productivity` with `{ request: string }`.
2. Controller authenticates and extracts `userId`.
3. Controller calls `runProductivityAgent(request, userId)`.
4. `createPlan()` generates a small plan.
5. `analyzeProductivity()` queries `FocusSession` documents and computes metrics.
6. `generateRecommendation()` produces a short recommendation string.
7. Controller returns `{ plan, analysis, recommendation }`.

## Docker build/run (brief)
- Build: `docker build -t focusflow-server .` (run from `server/`)
- Run (example):
  - `docker run -e MONGODB_URI=... -e JWT_SECRET=... -p 4000:4000 focusflow-server`


## Project Structure
```text
server/
  src/
    index.ts
    utils/config.ts
    controllers/
    routes/
    models/ (Mongoose)
    db/
      pg.ts
      queries/analyticsQueries.ts

client/
  src/
    App.tsx
    pages/
    components/
    features/
      timer/
        FocusTimer.tsx
        timerClosure.ts
      javascript-concepts/
```

## Important Modules
- **Timer Implementation**: The production timer is built into the UI using React state (`FocusTimer.tsx`). `timerClosure.ts` is explicitly created to demonstrate closure state masking independently.
- **SQL Analytics**: The queries leverage raw SQL parameterized strings.

## Database Schemas
### MongoDB (Mongoose)
- **User**: `{ _id, email, passwordHash, name }`
- **Task**: `{ _id, title, status, userId, createdAt }`
- **FocusSession**: `{ _id, taskId, userId, duration, startedAt, endedAt, status }`

### PostgreSQL
- **users**: `id, name`
- **tasks**: `id, title, user_id`
- **analytics_sessions**: `id, task_id, user_id, duration, started_at, ended_at`
