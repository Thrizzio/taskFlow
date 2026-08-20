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
