# Low-Level Design (LLD) — FocusFlow

## 1. Viva Topic → Implementation Mapping

| Topic                           | Exact Implementation                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| Environment variables & secrets | `.env.example`, `server/src/utils/config.ts`                     |
| Git workflow                    | Repository branches and commit history                           |
| async/await                     | `server/src/controllers/`, `client/src/pages/`                   |
| Closures                        | `createTaskFilter` in `client/src/pages/Tasks.tsx`               |
| Event loop                      | `client/src/features/javascript-concepts/EventLoopDemo.tsx`      |
| Hoisting                        | `client/src/features/javascript-concepts/HoistingDemo.tsx`       |
| Promises vs callbacks           | `client/src/features/javascript-concepts/promisesVsCallbacks.ts` |
| SQL JOINs                       | `server/src/db/queries/analyticsQueries.ts`                      |
| Multi-step agent                | `server/src/agent/productivityAgent.ts`                          |
| Docker                          | `server/Dockerfile`, `server/.dockerignore`                      |

---

# 2. Environment Variables & Secrets

### Files

* `.env.example` — documents required environment variables without exposing values.
* `server/src/utils/config.ts` — reads and validates configuration.
* `GEMINI_API_KEY` is used by the LLM stage.

### Design

Secrets are stored in environment variables rather than source code. `.env` is kept outside version control, while `.env.example` documents the required variable names.

`config.ts` provides a central configuration layer and validates required variables at runtime.

### Deployment

Production secrets are supplied through the deployment environment rather than committed to Git.

---

# 3. Git Workflow

### Branching

* `main` contains the stable project state.
* Feature/fix work is developed on separate branches.
* Changes are merged through pull requests.

### Commits

Commits are kept small and descriptive, using conventional prefixes such as:

* `feat:` — new functionality
* `fix:` — bug fixes
* `chore:` — maintenance/configuration

The purpose is to keep project history understandable and make changes easier to review.

---

# 4. JavaScript async/await

### Location

`server/src/controllers/`

Controller methods use `async` functions and `await` for asynchronous database/API operations.

### Error handling

Asynchronous operations are wrapped in `try/catch`.

Typical flow:

```text
HTTP request
    ↓
async controller
    ↓
await database/API operation
    ↓
success → HTTP response
failure → catch → error response
```

`await` makes promise-based operations readable as sequential code while `try/catch` handles rejected promises.

---

# 5. JavaScript Closures

### Production implementation

`client/src/pages/Tasks.tsx`

```typescript
export function createTaskFilter(statusFilter: string) {
    return function filterTask(task: Task): boolean {
        return statusFilter === 'all' || task.status === statusFilter;
    };
}
```

`filterTask` is a closure because it retains access to `statusFilter` from the lexical scope of `createTaskFilter` even after `createTaskFilter` returns.

### React integration

```typescript
useEffect(() => {
    const filter = createTaskFilter(statusFilter);
    const filtered = tasks.filter(filter);
    setVisibleTasks(filtered);
}, [tasks, statusFilter]);
```

The dependency array is important: when `statusFilter` changes, React re-runs the effect and creates a new closure containing the current value.

**Important:** closures do not themselves prevent stale state. The dependency array ensures the closure is recreated with current state.

---

# 6. JavaScript Event Loop

### Location

`client/src/features/javascript-concepts/EventLoopDemo.tsx`

The demo illustrates three execution stages:

1. **Synchronous code** executes immediately on the call stack.
2. **Promise callbacks** execute as microtasks.
3. **`setTimeout` callbacks** execute as macrotasks/tasks.

Therefore, the demonstrated ordering is:

```text
Synchronous code
      ↓
Microtask queue (Promises)
      ↓
Task/macrotask queue (setTimeout)
```

The example is designed to demonstrate why asynchronous callbacks do not execute immediately when they are registered.

---

# 7. JavaScript Hoisting

### Location

`client/src/features/javascript-concepts/HoistingDemo.tsx`

The demo compares:

* Function declarations — can be called before their declaration.
* `var` — declaration is hoisted and initialized to `undefined`.
* `let` / `const` — declarations are hoisted but remain in the Temporal Dead Zone until initialization.

The purpose is to demonstrate that "hoisting" does not mean every variable is safely usable before its declaration.

---

# 8. Promises vs Callbacks

### Location

`client/src/features/javascript-concepts/promisesVsCallbacks.ts`

The demo compares callback-based and promise-based asynchronous operations.

### Callbacks

The callback approach passes success/error handling into another function and can become difficult to maintain when operations are nested.

### Promises

Promises represent the eventual result of an asynchronous operation and provide:

* `.then()` for successful results
* `.catch()` for errors
* chaining for multiple dependent operations

The key advantage demonstrated is cleaner composition and centralized error propagation compared with deeply nested callbacks.

---

# 9. SQL JOINs

### Location

`server/src/db/queries/analyticsQueries.ts`

PostgreSQL contains:

```text
users
tasks
analytics_sessions
```

Relationships:

```text
users.id
   │
   ├── tasks.user_id
   │
   └── analytics_sessions.user_id

tasks.id
   │
   └── analytics_sessions.task_id
```

The analytics query combines related user, task, and session information using SQL JOINs rather than retrieving unrelated tables separately.

### Purpose

JOINs allow analytics queries to return related information such as:

```text
User → Task → Analytics Session
```

The exact JOIN type should be chosen according to whether records without a matching relationship must be retained or excluded.

---

# 10. Multi-Step Productivity Agent

### Entry point

```text
POST /api/agent/productivity
        ↓
agentRoutes.ts
        ↓
agentController.ts
        ↓
runProductivityAgent(requestText, userId)
```

### Pipeline

```text
User request
     ↓
Planner
     ↓
Analyzer
     ↓
LLM Insight
     ↓
Recommender
     ↓
Final response
```

### Stage 1 — Planner

**File:** `server/src/agent/planner.ts`

**Function:** `createPlan(request: string): Plan`

Converts the natural-language request into a deterministic analysis plan.

Output:

```typescript
{
    goals: string[],
    timeframe?: string
}
```

For example, keywords such as `"week"` can determine the requested timeframe.

### Stage 2 — Analyzer

**File:** `server/src/agent/analyzer.ts`

**Function:** `analyzeProductivity(plan, sessions)`

Uses the plan and MongoDB `FocusSession` documents to calculate:

* total focus minutes
* session count
* top task by focus time

It uses `Task.findById` to resolve the title of the top task.

### Stage 3 — LLM Insight

**File:** `server/src/agent/llmInsight.ts`

**Function:** `getLlmInsight(analysis, userRequest)`

Uses Google Gemini `gemini-2.0-flash-lite` through native Node.js `fetch`.

Input:

```text
AnalysisResult + original user request
```

Output:

```typescript
{
    insight: string,
    priority: string,
    reason: string,
    source: "llm" | "fallback"
}
```

The response is parsed as JSON and validated for the required fields.

### LLM failure handling

The workflow does not fail when the LLM is unavailable.

Fallback occurs when:

* `GEMINI_API_KEY` is missing
* Gemini returns an HTTP error
* JSON parsing fails
* `fetch` throws a network error

A deterministic insight is generated from the analysis metrics instead.

### Stage 4 — Recommender

**File:** `server/src/agent/recommender.ts`

**Function:** `generateRecommendation(analysis, insight)`

Combines:

```text
analysis metrics
      +
LLM insight
      +
priority/heuristic nudge
      ↓
human-readable recommendation
```

### Error propagation

* Missing request body → controller returns **HTTP 400**.
* LLM failure → deterministic fallback; pipeline continues.
* Database failure → analyzer throws; controller returns **HTTP 500**.

---

# 11. Docker Containerization

### Files

* `server/Dockerfile`
* `server/.dockerignore`

The Dockerfile defines the server's production container environment.

The container process follows:

```text
Base Node environment
      ↓
Set working directory
      ↓
Install dependencies
      ↓
Copy source
      ↓
Build TypeScript
      ↓
Expose application port
      ↓
Start server
```

`.dockerignore` prevents unnecessary files from being copied into the build context.

The purpose of containerization is to make the server's runtime and dependency environment reproducible across development and deployment.

---

# 12. Database Models

## MongoDB — Mongoose

### User

```text
_id
email
passwordHash
name
```

### Task

```text
_id
title
status
priority
userId
createdAt
```

### FocusSession

```text
_id
taskId
userId
duration
startedAt
endedAt
status
```

`FocusSession` references the task and user rather than duplicating their complete documents.

## PostgreSQL

### users

```text
id
name
```

### tasks

```text
id
title
user_id
```

### analytics_sessions

```text
id
task_id
user_id
duration
started_at
ended_at
```

These relational tables are joined in `analyticsQueries.ts` when analytics require data from multiple entities.
