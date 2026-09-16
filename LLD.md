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
| Tool calling                    | `server/src/agent/agentTools.ts`, `server/src/agent/llmInsight.ts` |
| Request validation              | `server/src/middleware/validate.ts`                              |
| Unit tests                      | `server/src/tests/unit/`                                         |
| Integration tests               | `server/src/tests/integration/`                                  |
| MongoDB indexing                | `server/src/models/FocusSession.ts`                              |
| Input Sanitization & Injection  | `server/src/utils/sanitize.ts`, `server/src/middleware/sanitize.ts` |
| OAuth 2.0 3rd-Party Login       | `server/src/utils/oauth.ts`, `server/src/controllers/authController.ts` |
| Role-Based Authorization (RBAC) | `server/src/middleware/role.ts`, `server/src/controllers/adminController.ts` |
| File Upload Handling & Security | `server/src/middleware/upload.ts`, `server/src/controllers/taskController.ts` |
| Frontend Container Deployment   | `client/Dockerfile`, `client/nginx.conf`, `client/src/config/api.ts` |
| ORM Usage (Prisma)              | `server/prisma/schema.prisma`, `server/src/db/prisma.ts`         |
| Database Transactions (ACID)    | `server/src/controllers/sessionController.ts` (`persistAnalyticsSessionTx`) |
| Redis Caching (Cache-Aside)     | `server/src/utils/redis.ts`, `server/src/controllers/analyticsController.ts` |
| Scheduled Cron Maintenance      | `server/src/jobs/cleanupJob.ts`, `server/src/jobs/scheduler.ts`  |
| WebSocket Real-Time Sync        | `server/src/socket.ts`, `client/src/context/SocketContext.tsx`   |

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

---

# 12. Token and Cost Monitoring

## Location

`server/src/agent/llmInsight.ts`

## Token Usage Extraction

Gemini's REST `generateContent` response includes a `usageMetadata` object. The `GeminiResponse` interface in `llmInsight.ts` is typed to include this field:

```typescript
usageMetadata?: {
    promptTokenCount?: number;      // input tokens
    candidatesTokenCount?: number;  // output tokens
    totalTokenCount?: number;       // sum
};
```

The `extractUsage()` function reads these fields and maps them to the `TokenUsage` interface:

```typescript
export interface TokenUsage {
    inputTokens: number;    // from promptTokenCount
    outputTokens: number;   // from candidatesTokenCount
    totalTokens: number;    // from totalTokenCount
}
```

Any missing field defaults to `0` (optional chaining + nullish coalescing).

## Cost Calculation

`calculateCost(usage: TokenUsage)` in `llmInsight.ts` reads rates from `config.GEMINI_PRICING`:

```
estimatedCostUsd = (inputTokens  / 1000) × inputPer1kTokens
                 + (outputTokens / 1000) × outputPer1kTokens
```

## Pricing Configuration

Rates are defined once in `server/src/utils/config.ts`:

```typescript
GEMINI_PRICING: {
    inputPer1kTokens:  0.000075,  // USD per 1,000 input tokens
    outputPer1kTokens: 0.000300,  // USD per 1,000 output tokens
}
```

No other file contains token rate numbers.

## LlmInsight Output Fields

`usage` and `estimatedCostUsd` are added to the `LlmInsight` interface and returned in every response:

```typescript
export interface LlmInsight {
    insight: string;
    priority: string;
    reason: string;
    source: 'llm' | 'fallback';
    usage: TokenUsage;
    estimatedCostUsd: number;
}
```

## Fallback Path

When the fallback path is used: `usage` is `{ inputTokens: 0, outputTokens: 0, totalTokens: 0 }` and `estimatedCostUsd` is `0`. No fabricated values appear.

---

# 13. LLM Evaluation Sets

## Files

| File | Role |
|------|------|
| `server/src/agent/eval/evalCases.ts` | Evaluation dataset — 4 test cases with mock inputs and criteria |
| `server/src/agent/eval/evalRunner.ts` | Runner — executes cases, scores results, prints report |

## Evaluation Cases

Each entry in `evalCases` has:

```typescript
interface EvalCase {
    id: string;               // unique identifier (e.g. 'eval-01')
    description: string;      // human-readable description
    userRequest: string;      // natural-language input to the agent
    mockAnalysis: AnalysisResult; // synthetic metrics — no DB access
    criteria: EvalCriteria;   // pass/fail rules
}
```

The `mockAnalysis` replaces real session data, making the eval self-contained.

## Evaluation Criteria

```typescript
interface EvalCriteria {
    insightNonEmpty: true;                // insight must be a non-empty string
    reasonNonEmpty: true;                 // reason must be a non-empty string
    priorityContainsOneOf: string[];      // priority must contain one keyword (case-insensitive)
    sourceIs: Array<'llm' | 'fallback'>; // source must be one of these values
}
```

Criteria check semantic properties, not exact strings. This is appropriate for LLM output, which is non-deterministic.

## Runner Flow

1. Loads all cases from `evalCases`.
2. Calls `getLlmInsight(mockAnalysis, userRequest)` for each.
3. Scores the `LlmInsight` result against `EvalCriteria` via `scoreResult()`.
4. Prints a per-case PASS/FAIL line and a detailed report including token/cost information.
5. Exits with code 1 if any case fails.

## Running the Evaluation

```
npm run eval
```
(from `server/`)

## Cases Covered

| ID | Scenario | Key Criterion |
|----|----------|---------------|
| eval-01 | Zero sessions | Priority suggests starting |
| eval-02 | Low focus time (30 min) | Priority relates to volume |
| eval-03 | High focus time (150 min) | Priority relates to consistency |
| eval-04 | Moderate time, specific task question | Priority relates to volume or focus |

---

# 14. Controlled Tool Calling

## Files

| File | Role |
|------|------|
| `server/src/agent/agentTools.ts` | Tool declarations, TOOL_REGISTRY whitelist, `executeTool` dispatcher |
| `server/src/agent/llmInsight.ts` | Multi-turn flow: sends TOOL_DECLARATIONS, handles `functionCall`, sends `functionResponse` |

## Tool Declarations

`TOOL_DECLARATIONS` is an array sent to Gemini in the `tools[].functionDeclarations` field:

```typescript
{
    name: 'getProductivitySummary',
    description: 'Returns structured productivity metrics from recorded focus sessions.',
    parameters: { type: 'object', properties: { includeTopTask: { type: 'boolean' } } }
}
```

## TOOL_REGISTRY (server-side whitelist)

```typescript
const TOOL_REGISTRY: Record<string, Function> = {
    getProductivitySummary,   // only this name is allowed to execute
};
```

`executeTool(name, args, analysis)` looks up `name` in `TOOL_REGISTRY` and returns `null` if not found. No execution happens for unrecognised names.

## Multi-Turn Flow in llmInsight.ts

1. First `fetch` call: sends prompt + `tools` array to Gemini.
2. If the response `candidate.content.parts` contains a `functionCall` object:
   - `executeTool(name, args, analysis)` is called.
   - If `null` is returned (unknown tool), the flow skips the second turn.
   - If a `ToolResult` is returned, a second `fetch` call is made including a `functionResponse` part.
3. The text from the final response is parsed as the insight JSON.

---

# 15. Request Body Validation

## File

`server/src/middleware/validate.ts`

## FieldRule Interface

```typescript
interface FieldRule {
    required?: boolean;
    type?: 'string' | 'number';
    minLength?: number;
    isEmail?: boolean;
}
```

## validate() Middleware Factory

`validate(schema)` returns an Express middleware. For each field in the schema:
1. Checks `required` — returns 400 if absent or empty.
2. Checks `type` — returns 400 if wrong type.
3. Checks `minLength` — returns 400 if string is too short.
4. Checks `isEmail` — returns 400 if regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` fails.
5. On all checks passing → calls `next()`.

## Schemas and Endpoints Covered

| Schema | Endpoint | Rule summary |
|--------|----------|--------------|
| `registerSchema` | `POST /api/auth/register` | name required, email required+isEmail, password required+minLength 6 |
| `loginSchema` | `POST /api/auth/login` | email required+isEmail, password required |
| `createTaskSchema` | `POST /api/tasks` | title required+minLength 1 |
| `agentRequestSchema` | `POST /api/agent/productivity` | request required+minLength 1 |

---

# 16. Unit Tests

## Location

`server/src/tests/unit/`

## Test Files and What They Test

| File | Function under test | What is verified |
|------|--------------------|-----------------|
| `createTaskFilter.test.ts` | `createTaskFilter` closure | all/pending/completed filter, empty result, closure independence |
| `planner.test.ts` | `createPlan` | standard goals always present, week/day timeframe, no-timeframe edge case |
| `agentTools.test.ts` | `executeTool` + cost formula | known tool executes, unknown tool returns null, cost arithmetic |

**Run command:** `npm test` (from `server/`)

**Result: 20 tests across 3 files — all pass without database or network.**

---

# 17. Integration Tests

## Location

`server/src/tests/integration/`

## App Factory

`server/src/testApp.ts` — exports `createApp()` which builds the Express app (routes, middleware, JSON parsing) without starting a server or connecting to a database. Integration tests import this function.

## Test Files and Endpoints Covered

| File | Endpoints tested | Cases |
|------|-----------------|-------|
| `auth.test.ts` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/health`, `GET /api/tasks` (auth check) | Validation 400, missing fields 400, invalid credentials 401, valid JWT passes auth |
| `tasks.test.ts` | `GET /api/tasks`, `POST /api/tasks`, `POST /api/agent/productivity` | 401 without token, 400 missing title, 400 missing request field, 200 with valid JWT |

**Run command:** `npm run test:integration` (from `server/`)

**Result: 19 tests across 2 files — all pass. Mongoose models are mocked via `vi.mock`. No real DB or Gemini API key required.**

## Difference from Unit Tests

| Dimension | Unit tests | Integration tests |
|-----------|-----------|------------------|
| Entry point | Function call | HTTP request via supertest |
| What is exercised | Function logic only | Router + middleware + controller |
| Mocking | None (pure functions) | Mongoose models mocked |
| Purpose | Verify correctness of logic | Verify routing/middleware behavior |

---

# 18. MongoDB Indexes

## File

`server/src/models/FocusSession.ts`

## Indexes Added

```typescript
focusSessionSchema.index({ userId: 1 });
focusSessionSchema.index({ userId: 1, taskId: 1 });
```

## Index-to-Query Mapping

| Index | Query that uses it | Why |
|-------|-------------------|-----|
| `{ userId: 1 }` | `FocusSession.find({ userId })` in `productivityAgent.ts` | Retrieves all sessions for a user without a full collection scan |
| `{ userId: 1, taskId: 1 }` | Session grouping by `taskId` in `analyzeProductivity` | Covered by the compound index prefix for `userId`, and supports efficient per-task aggregation |

## Why Other Fields Were Not Indexed

* `status` — no query filters on status alone.
* `duration` — used in arithmetic after fetch, not as a filter.
* `startedAt` / `endedAt` — not filtered or sorted in any current query.

## Task Collection

`Task.userId` already has `{ index: true }` defined inline in `Task.ts`. No change was needed.




---
# 19. JWT Issuance & Verification

## Purpose
To provide stateless, secure authentication.

## Implementation & Relevant Files
*   **Issuance:** `server/src/controllers/authController.ts` (`login` and `register`). Creates a JWT using `jsonwebtoken.sign`.
*   **Claims:** `{ userId: user._id, name: user.name }` are embedded.
*   **Verification:** `server/src/middleware/auth.ts` extracts the token from the `Bearer` header, calls `jwt.verify()` with `config.JWT_SECRET`, and attaches `req.user`.
*   **Configuration:** `server/src/utils/config.ts` loads `JWT_SECRET` from the environment.
*   **Fallback:** Returns 401 if token is missing/invalid.

## Design Reasoning
Stateless tokens avoid managing server-side session stores, keeping the Express instances stateless.


---
# 20. Backend Deployment

## Implementation & Relevant Files
*   **Dockerfile:** `server/Dockerfile` implements a multi-stage build (`builder` stage for `tsc`, `production` stage for running `dist/index.js`).
*   **Security:** Only the compiled `dist/` and runtime dependencies are copied into the final image.

## Configuration Flow
Environment variables are injected at container runtime and parsed in `server/src/utils/config.ts`, validating required keys before startup.


---
# 21. 3rd-Party API Integration (Gemini)

## Implementation & Relevant Files
*   **File:** `server/src/agent/llmInsight.ts`.
*   **Method:** Uses standard `fetch` to `https://generativelanguage.googleapis.com/v1beta/...`.
*   **Cost Calculation:** Extracts `usageMetadata.promptTokenCount` and uses constants in `config.ts` to calculate estimated cost.
*   **Graceful Degradation:** If `GEMINI_API_KEY` is empty or a network error occurs, it returns a static fallback insight (`priority: 'unknown'`).


---
# 22. Form Handling — Controlled Inputs

## Implementation & Relevant Files
*   **Files:** `client/src/pages/Login.tsx` and `Tasks.tsx`.
*   **Pattern:**
    ```tsx
    const [title, setTitle] = useState('');
    // ...
    <input value={title} onChange={(e) => setTitle(e.target.value)} />
    ```
*   **Benefit:** React retains full authority over the form. Submitting relies on current state, not DOM reading.


---
# 23. Form Validation (Client-Side)

## Implementation & Relevant Files
*   **File:** `client/src/pages/Login.tsx`.
*   **Implementation:** Pre-flight check inside `handleSubmit` verifies `password.length >= 6` and sets `setError` immediately if it fails.
*   **Trade-offs:** Redundant logic is maintained on front and back end, but provides a demonstrably superior user experience.


---
# 24. Loading & Error UI States

## Implementation & Relevant Files
*   **File:** `client/src/pages/Tasks.tsx`
*   **Flow:** `fetchTasks()` sets `setIsLoading(true)` natively, blocking empty list renders. A `finally` block ensures the loading state completes safely.


---
# 25. Responsive Layout & Styling

## Implementation & Relevant Files
*   **File:** `client/src/pages/Tasks.tsx`.
*   **Methodology:** Uses inline `<style>` tags setting `flex-direction: column` for `.task-card` and `.header-container` classes below 600px width. Maintains simple structure without large framework dependencies.


---
# 26. SQL Filtering, Ordering, Grouping

## Implementation & Relevant Files
*   **File:** `server/src/db/queries/analyticsQueries.ts`.
*   **Role:** `getTimeSpentPerUserPerTask(userId)`.
*   **Query Operations:** 
    *   `WHERE u.id = $1` (Parameterized, SQL Injection proof filtering).
    *   `GROUP BY u.name, t.title` (Rolls up multiple session logs into distinct Task rows).
    *   `SUM(s.duration)` (Aggregation function).
    *   `ORDER BY "totalSeconds" DESC` (Sorting workload executed in DB).


---
# 27. PostgreSQL Indexing for Performance

## Implementation & Relevant Files
*   **File:** `server/src/db/pg.ts`.
*   **Indexes Created:**
    *   `idx_analytics_sessions_user_id` on `analytics_sessions(user_id)`
    *   `idx_analytics_sessions_task_id` on `analytics_sessions(task_id)`
*   **Justification:** The analytics query filters heavily on `user_id` and joins on `task_id`. Without these indexes, counting or aggregating sessions would devolve into sequential scans over potentially gigabytes of chronological session data.


---
# 28. Input Sanitization & Injection Defense

## Implementation & Relevant Files
*   **Files:** `server/src/utils/sanitize.ts`, `server/src/middleware/sanitize.ts`, `server/src/controllers/taskController.ts`.
*   **Middleware Integration:** `app.use(sanitizeRequest)` registered globally in `server/src/index.ts` and `server/src/testApp.ts`.

## Key Code Architecture
```typescript
// Strip MongoDB operator injection ($gt, $ne, $where, etc.)
export function sanitizeMongoInput<T>(input: T): T {
    if (Array.isArray(input)) return input.map(sanitizeMongoInput) as unknown as T;
    if (input !== null && typeof input === 'object') {
        const clean: Record<string, any> = {};
        for (const [key, value] of Object.entries(input)) {
            if (key.startsWith('$') || key.includes('.')) continue; // Strip operator keys
            clean[key] = sanitizeMongoInput(value);
        }
        return clean as T;
    }
    return input;
}

// Escape HTML control characters to block XSS
export function sanitizeString(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
```

## Viva Explanation: Validation vs Sanitization
*   **Validation** is the gatekeeper that checks whether input matches expected shape, data type, length, or constraints (e.g. `password must be at least 6 characters`). If invalid, the request is **rejected** with an error (HTTP 400).
*   **Sanitization** is the transformer that cleanses or neutralizes dangerous characters from input before it reaches storage or output sinks (e.g. stripping `$` from query objects or escaping `<script>` into `&lt;script&gt;`).
*   **Why both?** Validation ensures logical contract compliance; sanitization provides defense-in-depth against malicious payloads that conform syntactically to the contract.


---
# 29. Third-Party OAuth 2.0 Authentication

## Implementation & Relevant Files
*   **Files:** `server/src/utils/oauth.ts`, `server/src/controllers/authController.ts`, `server/src/routes/authRoutes.ts`, `server/src/models/User.ts`.
*   **Endpoints:** `GET /api/auth/google/url`, `POST /api/auth/google/callback`.

## Key Code Architecture
```typescript
// Authorization Code exchange with Google Token Endpoint
export async function exchangeCodeForGoogleUser(code: string): Promise<GoogleUser> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: config.GOOGLE_CLIENT_ID || '',
            client_secret: config.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: config.GOOGLE_CALLBACK_URL || '',
            grant_type: 'authorization_code',
        }),
    });
    const tokens = await tokenRes.json();
    // Fetch verified profile using access token...
}
```

## Viva Explanation: Authorization Code Flow
*   The client redirects the browser to Google's consent screen.
*   Google redirects back with a short-lived, single-use **authorization code**.
*   The server exchanges the authorization code for an `access_token` and `id_token` directly with Google over back-channel HTTPS, utilizing the `client_secret`.
*   The `client_secret` is never exposed to the frontend, preventing token theft and spoofing.


---
# 30. Role-Based Access Control (RBAC)

## Implementation & Relevant Files
*   **Files:** `server/src/middleware/role.ts`, `server/src/middleware/auth.ts`, `server/src/controllers/adminController.ts`, `server/src/routes/adminRoutes.ts`.
*   **User Schema:** `server/src/models/User.ts` (field `role: { type: String, enum: ['user', 'admin'], default: 'user' }`).

## Key Code Architecture
```typescript
export function requireRole(...allowedRoles: ('user' | 'admin')[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized: authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
            return;
        }
        next();
    };
}
```

## Viva Explanation: Authentication vs Authorization
*   **Authentication (AuthN):** Confirms identity (*Who are you?*). Handled by `authenticate` middleware by verifying the cryptographic signature of the JWT bearer token.
*   **Authorization (AuthZ):** Confirms permissions (*What are you allowed to do?*). Handled by `requireRole('admin')` by inspecting the role claim stored within the decoded token.
*   **HTTP 401 vs 403:** 401 Unauthorized denotes missing or invalid authentication credentials. 403 Forbidden denotes authenticated identity recognized, but lacking necessary rights to execute the action.


---
# 31. File Upload Handling & Storage Security

## Implementation & Relevant Files
*   **Files:** `server/src/middleware/upload.ts`, `server/src/controllers/taskController.ts`, `server/src/models/Task.ts`.
*   **Endpoints:**
    *   `POST /api/tasks/:taskId/attachments`
    *   `GET /api/tasks/:taskId/attachments`
    *   `GET /api/tasks/:taskId/attachments/:attachmentId`
    *   `DELETE /api/tasks/:taskId/attachments/:attachmentId`

## Key Code Architecture
```typescript
// Enforce random UUID storage naming to block overwrite & execution attacks
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDirectory),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    }
});

// Enforce path traversal prevention
export function isSafeFilePath(baseDirectory: string, requestedPath: string): boolean {
    const resolvedBase = path.resolve(baseDirectory);
    const resolvedTarget = path.resolve(requestedPath);
    return resolvedTarget.startsWith(resolvedBase + path.sep);
}
```

## Viva Explanation: Upload Vulnerabilities & Defense
*   **Unrestricted File Upload:** Storing user files with original filenames can overwrite system binaries or allow execution of PHP/Node scripts. Solved by replacing names with `crypto.randomUUID()`, stripping paths, and whitelisting safe extensions (`.pdf`, `.png`, `.jpg`, `.txt`, `.md`).
*   **Path Traversal (Zip Slip / Directory Traversal):** Attackers supply `../../etc/passwd`. Solved by validating `resolvedTarget.startsWith(resolvedBase + path.sep)` before executing any filesystem operation.


---
# 32. Production Frontend Deployment & Containerization

## Implementation & Relevant Files
*   **Files:** `client/Dockerfile`, `client/nginx.conf`, `client/src/config/api.ts`, `client/.env.example`.
*   **Build Pipeline:** Multi-stage Dockerfile (`node:22-alpine` build stage -> `nginx:alpine` runtime stage).

## Key Code Architecture
```nginx
# client/nginx.conf SPA fallback routing
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## Viva Explanation: SPA Routing in Nginx
*   In a Single-Page Application (SPA), client routes (e.g. `/tasks`, `/focus`) exist only in browser memory managed by `react-router-dom`.
*   When a user refreshes `/tasks`, the web server looks for a physical file `/tasks/index.html` on disk. Without SPA routing, Nginx returns HTTP 404.
*   The `try_files $uri $uri/ /index.html;` directive instructs Nginx: if the requested file doesn't exist on disk, serve `index.html` with HTTP 200, allowing React Router to mount and render the correct route.


---
# 33. Object-Relational Mapping (Prisma ORM)

## Implementation & Relevant Files
*   **Files:** `server/prisma/schema.prisma`, `server/src/db/prisma.ts`, `server/src/db/queries/analyticsQueries.ts`.
*   **Models:** `User`, `Task`, `AnalyticsSession`.

## Key Code Architecture
```prisma
model AnalyticsSession {
  id        Int      @id @default(autoincrement())
  taskId    String   @map("task_id")
  userId    String   @map("user_id")
  duration  Int
  startedAt DateTime @map("started_at")
  endedAt   DateTime @map("ended_at")
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "idx_analytics_sessions_user_id")
  @@index([taskId], map: "idx_analytics_sessions_task_id")
  @@map("analytics_sessions")
}
```

## Viva Explanation: Raw SQL vs ORM Trade-offs
*   **Prisma ORM:** Provides end-to-end type safety (TypeScript types generated from schema), auto-completion, declarative schema migrations, and parameterized query construction that prevents SQL injection.
*   **Raw SQL (`node-postgres`):** Provides maximal control over execution plans, custom CTEs, and minimal memory overhead.
*   **TaskFlow Architecture:** Both are maintained side-by-side to demonstrate practical trade-offs. The analytics reporting layer uses Prisma ORM as primary with fallback to raw SQL.


---
# 34. Database Transactions & ACID Semantics

## Implementation & Relevant Files
*   **Files:** `server/src/controllers/sessionController.ts` (`persistAnalyticsSessionTx`).
*   **Verification:** `server/src/tests/integration/transaction.test.ts`.

## Key Code Architecture
```typescript
export async function persistAnalyticsSessionTx(params: AnalyticsTransactionParams) {
    return await prisma.$transaction(async (tx) => {
        // Step 1: Upsert User record
        await tx.user.upsert({
            where: { id: params.userId },
            update: { name: params.userName },
            create: { id: params.userId, name: params.userName },
        });

        // Step 2: Upsert Task record
        await tx.task.upsert({
            where: { id: params.taskId },
            update: { title: params.taskTitle },
            create: { id: params.taskId, title: params.taskTitle, userId: params.userId },
        });

        // Step 3: Insert Analytics Session record
        return await tx.analyticsSession.create({
            data: {
                taskId: params.taskId,
                userId: params.userId,
                duration: params.duration,
                startedAt: new Date(params.startedAt),
                endedAt: new Date(params.endedAt),
            },
        });
    });
}
```

## Viva Explanation: ACID Semantics & Heterogeneous Transaction Boundaries
*   **ACID Guarantees:**
    *   **Atomicity:** If inserting the analytics session fails, the user and task upserts are rolled back completely.
    *   **Consistency:** Foreign key constraints are validated before committing.
    *   **Isolation:** Uncommitted writes are invisible to concurrent queries.
    *   **Durability:** Once committed, writes survive process crashes.
*   **Architectural Boundary:** A single local database transaction cannot atomically span across both MongoDB and PostgreSQL without distributed two-phase commit (2PC) or Saga orchestrators. TaskFlow encapsulates operational state in MongoDB and isolates the ACID transaction boundary within PostgreSQL.


---
# 35. Redis In-Memory Caching (Cache-Aside Pattern)

## Implementation & Relevant Files
*   **Files:** `server/src/utils/redis.ts`, `server/src/controllers/analyticsController.ts`, `server/src/controllers/sessionController.ts`.
*   **Verification:** `server/src/tests/integration/redisCache.test.ts`.

## Key Code Architecture
```typescript
// Cache-Aside Pattern in analyticsController.ts
export const getAnalytics = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId || '';
    const cacheKey = `analytics:user:${userId}:time-by-task`;

    // 1. Check in-memory Redis cache
    const cached = await getCachedJson(cacheKey);
    if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
    }

    // 2. Cache miss: Query relational store
    const data = await getTimeSpentPerUserPerTaskPrisma(userId);

    // 3. Write back to Redis with TTL
    await setCachedJson(cacheKey, data, config.REDIS_CACHE_TTL);

    res.setHeader('X-Cache', 'MISS');
    res.json(data);
};
```

## Viva Explanation: Cache Patterns & Invalidation
*   **Cache-Aside (Lazy Loading):** The application reads from the cache; on miss, it reads from the database and writes back to cache. Data is only cached when requested, preventing memory waste on unread data.
*   **Cache Invalidation:** When a new focus session is saved, `invalidateCachePattern('analytics:user:${userId}:*')` purges the stale cache entry immediately, guaranteeing consistency for the next read.
*   **Offline Fallback:** If Redis is offline, calls gracefully return `null` and fall back to PostgreSQL without crashing the API.


---
# 36. Scheduled Background Jobs (Cron Maintenance)

## Implementation & Relevant Files
*   **Files:** `server/src/jobs/cleanupJob.ts`, `server/src/jobs/scheduler.ts`, `server/src/index.ts`.
*   **Verification:** `server/src/tests/unit/cleanupJob.test.ts`.

## Key Code Architecture
```typescript
// Background cleanup job with grace period protection
export async function runMaintenanceJob(options = {}): Promise<CleanupJobResult> {
    const files = await fs.promises.readdir(uploadDir);
    const tasks = await Task.find({ 'attachments.0': { $exists: true } }, { 'attachments.filename': 1 }).lean();
    const referenced = new Set(tasks.flatMap(t => t.attachments.map(a => a.filename)));

    for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const stat = await fs.promises.stat(filePath);
        if (referenced.has(file)) continue;

        // Unreferenced file: check 24h grace period
        if (Date.now() - stat.mtimeMs >= maxAgeMs) {
            await fs.promises.unlink(filePath);
            result.deleted++;
        }
    }
    return result;
}
```

## Viva Explanation: Background Maintenance & Grace Periods
*   **Why a Grace Period?** Deleting unreferenced files immediately could destroy concurrent uploads where Multer has saved the file to disk but the MongoDB `Task.save()` request is still in flight. A 24-hour grace period guarantees safety.
*   **Fail-Safe Design:** If MongoDB lookup fails, deletion is aborted immediately, preventing catastrophic data loss during database partitions.


---
# 37. Real-Time WebSocket Communication (Socket.IO)

## Implementation & Relevant Files
*   **Files:** `server/src/socket.ts`, `server/src/controllers/taskController.ts`, `client/src/context/SocketContext.tsx`, `client/src/pages/Tasks.tsx`.
*   **Verification:** `server/src/tests/integration/socket.test.ts`.

## Key Code Architecture
```typescript
// Handshake Authentication & User Room Routing
export function authenticateSocketHandshake(socket: Socket, next: (err?: any) => void) {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication error: missing token'));
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET as string) as any;
        (socket as AuthenticatedSocket).data.user = decoded;
        next();
    } catch {
        return next(new Error('Authentication error: invalid or expired token'));
    }
}

// User-scoped Room Broadcast
export function emitTaskCreated(userId: string, task: any) {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('task:created', task);
}
```

## Viva Explanation: WebSocket vs HTTP Polling
*   **HTTP Polling:** The client repeatedly makes HTTP requests (e.g. every 3 seconds). Generates massive header overhead (HTTP headers on every poll), consumes battery, and introduces an average latency of half the polling interval.
*   **WebSocket:** Establishes a persistent, bi-directional TCP connection after a single HTTP upgrade handshake. Server pushes events immediately (`task:created`) with minimal frame overhead (< 6 bytes), providing sub-millisecond real-time synchronization.
*   **Tenant Isolation:** Using Socket.IO rooms (`user:${userId}`) ensures broadcasts are strictly isolated to the authenticated user's active devices and tabs.

