# High-Level Design (HLD) — FocusFlow

## 1. System Architecture

FocusFlow uses a distributed client-server architecture with real-time push and caching capabilities:

```text id="hldarch"
React Client (Nginx SPA Container)
    ↕ HTTP / REST (JWT Auth) + WebSocket (Socket.IO Real-time Events)
Node.js + Express API Server (Docker Container)
    ├── Redis (In-Memory Cache-Aside Layer for Analytics)
    ├── MongoDB (Mongoose Operational Store: Users, Tasks, Sessions)
    ├── PostgreSQL (Prisma ORM Analytics Store: Relational Aggregations)
    ├── Google Identity Services (OAuth 2.0 3rd-Party Login)
    ├── Google Gemini API (LLM Productivity Insights)
    ├── Local File System (/uploads directory with path traversal protection)
    └── Background Cron Scheduler (node-cron maintenance jobs)
```

### Components

* **Client:** React + Vite + TypeScript + React Router packaged in an Nginx container. Handles UI state, real-time WebSocket event listeners, and API communication.
* **Server:** Node.js + Express + TypeScript HTTP & Socket.IO server. Handles authentication, RBAC, input sanitization, file uploads, transactions, and background jobs.
* **Redis:** In-memory key-value cache implementing the Cache-Aside pattern for read-heavy analytics queries.
* **MongoDB:** Mongoose-based operational document storage for users, tasks, and focus sessions.
* **PostgreSQL:** Relational analytical store accessed via Prisma ORM for type-safe queries, indexed joins, and multi-entity ACID transactions.
* **Socket.IO:** Real-time bi-directional event layer with JWT handshake authentication and user-scoped rooms.
* **node-cron:** In-process scheduler executing background maintenance and orphaned file cleanup.
* **Gemini API:** External LLM used selectively by the productivity-agent workflow with deterministic offline fallbacks.

---

## 2. Authentication Flow

```text id="authflow"
Register / Login
      ↓
Express Controller
      ↓
Validate credentials
      ↓
Issue JWT
      ↓
Client
      ↓
Authorization: Bearer <token>
      ↓
Protected API route
      ↓
JWT verification
```

JWT provides stateless authentication. Protected routes verify the token before accessing user-specific resources.

---

## 3. Focus Session Flow

```text id="sessionflow"
User selects task
      ↓
React timer
      ↓
Session completed
      ↓
POST /api/focus-sessions
      ↓
Express server
      ├── MongoDB → FocusSession document
      └── PostgreSQL → analytics_sessions row
```

MongoDB stores the operational session record, while PostgreSQL stores the structured representation required for analytics.

---

## 4. Closure-Based Task Filtering

The production Tasks page uses:

```text id="closureflow"
createTaskFilter(statusFilter)
        ↓
returns filterTask()
        ↓
tasks.filter(filterTask)
```

The returned function closes over `statusFilter`.

A React `useEffect` with `[tasks, statusFilter]` recreates the closure whenever either value changes, ensuring the filtering logic uses the current state.

Implementation: `client/src/pages/Tasks.tsx`.

---

# 5. Multi-Step Productivity Agent

### Entry Point

```text id="agententry"
POST /api/agent/productivity
        ↓
agentRoutes.ts
        ↓
agentController.ts
        ↓
runProductivityAgent()
```

### Pipeline

```text id="agentpipeline"
User Request
     ↓
┌──────────────┐
│   Planner    │
└──────┬───────┘
       ↓ Plan
┌──────────────┐
│   Analyzer   │
└──────┬───────┘
       ↓ AnalysisResult
┌──────────────┐
│ LLM Insight  │ ← Gemini API
└──────┬───────┘
       ↓ LlmInsight
┌──────────────┐
│ Recommender  │
└──────┬───────┘
       ↓
Final Recommendation
```

### Responsibilities

| Stage       | Responsibility                                        | Input → Output                            |
| ----------- | ----------------------------------------------------- | ----------------------------------------- |
| Planner     | Interprets the request and determines what to analyze | Request → `Plan`                          |
| Analyzer    | Calculates productivity metrics from sessions         | `Plan` + sessions → `AnalysisResult`      |
| LLM Insight | Interprets metrics using Gemini                       | `AnalysisResult` + request → `LlmInsight` |
| Recommender | Produces the final recommendation                     | `AnalysisResult` + `LlmInsight` → string  |

### Why it is multi-step

Each stage has a defined input and output, and each stage consumes the output of the previous stage.

The stages are intentionally separated so that:

* metric calculation does not depend on the LLM;
* the LLM is isolated behind one stage;
* LLM failures can fall back to deterministic insights;
* recommendation formatting is separate from data analysis.

### LLM Failure Handling

The agent continues with a deterministic fallback when:

* `GEMINI_API_KEY` is unavailable;
* the Gemini request fails;
* Gemini returns an invalid response.

A database failure instead propagates to the controller and results in an HTTP 500 response.

---

# 6. External Systems

* **MongoDB:** operational application data.
* **PostgreSQL:** analytics and reporting.
* **Gemini API:** external LLM reasoning.
* **JWT:** stateless authentication mechanism.

The Node.js server acts as the central orchestrator between the client, databases, and Gemini.

---

# 7. Deployment & Docker


FocusFlow containerizes the Node.js server so that the application runtime is isolated from the host environment and can be deployed consistently.


### Docker Structure


The server uses:


* `server/Dockerfile` — defines the container build and runtime environment.
* `server/.dockerignore` — prevents unnecessary development files from being included in the Docker build context.


The Dockerfile uses a multi-stage build:


```text
Source Code
    ↓
Builder Stage
    ├── Install dependencies
    ├── Compile TypeScript
    └── Generate dist/
    ↓
Production Stage
    ├── Install production dependencies only
    └── Copy compiled dist/
    ↓
Production Container

The builder stage contains the dependencies and tooling required to compile the TypeScript server.

The production stage is kept separate from the build environment. It installs only production dependencies and copies the compiled dist/ output from the builder stage. Development dependencies such as the TypeScript compiler and tsx are therefore not required in the final runtime image.

This reduces the size and attack surface of the production image while keeping the build process reproducible.

External Services

Only the Node.js application server is containerized.

MongoDB and PostgreSQL remain external services:

Docker Container
    │
    ├── Node.js + Express
    │
    ├── → MongoDB
    │
    └── → PostgreSQL


External API
    ↑
Gemini API

This separation means the application container does not need to manage database lifecycles. Database connection information is supplied through environment variables.

Environment Configuration

Sensitive and environment-specific configuration is not stored directly in the Docker image or source code.

Values such as:

GEMINI_API_KEY
MongoDB connection information
PostgreSQL connection information
JWT configuration

are supplied through environment variables at runtime.

This allows the same container image to be used across different environments without rebuilding the application with different credentials.

Deployment Strategy

The intended deployment strategy is to build the server as a Docker image and run that image in a container-based deployment environment.

The process is:

Git Repository
      ↓
Docker Build
      ↓
Multi-stage Docker Image
      ↓
Production Container
      ↓
Environment Variables
      ↓
External MongoDB / PostgreSQL / Gemini API

The application is therefore separated into:

A reproducible application image containing the server runtime.
External managed services containing persistent data.
Runtime configuration supplied by the deployment environment.

This allows application code and infrastructure configuration to remain separate.

Anticipated Deployment Challenges

Several practical deployment issues were considered when designing the containerization strategy.

1. Build-time vs runtime dependencies

The TypeScript compiler and other development tools are required during the build but are unnecessary when running the application. The multi-stage Docker build addresses this by keeping build dependencies in the builder stage and copying only the compiled application into the production stage.

2. Environment-specific configuration

The container cannot rely on local .env files or development-machine configuration. Runtime secrets such as GEMINI_API_KEY therefore need to be provided by the deployment environment.

3. Database connectivity

MongoDB and PostgreSQL are outside the application container. The deployed server must therefore receive valid connection strings and have network access to those external services.

4. Differences between local and container environments

A container provides a controlled Node.js runtime, but local development and production can still differ in configuration, networking, and environment variables. Keeping the Dockerfile explicit and separating the build and production stages reduces these differences.

5. Image size and unnecessary files

Including the entire development environment in the production image would increase image size and include tools that are not needed at runtime. The multi-stage build and .dockerignore are used to keep the production image focused on the compiled server and its production dependencies.

Deployment Goal

The overall deployment design is to produce a small, reproducible production image containing only what is required to run the FocusFlow server, while keeping databases, secrets, and other external services outside the application container.

# 8. LLM Evaluation Workflow

An offline evaluation workflow tests the productivity agent's LLM stage using a fixed set of representative inputs.

```text
Evaluation Cases (evalCases.ts)
        ↓
Eval Runner (evalRunner.ts)
        ↓
getLlmInsight() — same function as production
        ↓
Score result against criteria
        ↓
Pass / Fail report
```

* The runner calls the same `getLlmInsight` function used in production.
* Synthetic `AnalysisResult` objects are supplied instead of real database data, keeping the evaluation self-contained.
* The fallback path is deterministic, so evaluation is reproducible without a live Gemini key.

---

# 9. Token and Cost Monitoring

Token usage and estimated cost are captured at the LLM Insight stage, alongside the insight content.

```text
Gemini REST response
        ↓
  usageMetadata
  ├── promptTokenCount     → usage.inputTokens
  ├── candidatesTokenCount → usage.outputTokens
  └── totalTokenCount      → usage.totalTokens
        ↓
  calculateCost(usage)
  using GEMINI_PRICING from config.ts
        ↓
  estimatedCostUsd
```

* Token counts come directly from the Gemini `usageMetadata` object in the REST response.
* Pricing rates are defined once in `config.ts` and not duplicated elsewhere.
* On the fallback path, both usage and cost are reported as zero.
* The monitoring fields (`usage`, `estimatedCostUsd`) are returned in the API response alongside the insight.

---

# 10. Controlled Tool Calling

The LLM Insight stage supports a multi-turn tool-calling flow. The LLM may request one predefined tool; the server validates the name, executes the function, and returns the result in a second request.

```text
Turn 1 — Initial Gemini request
  User request + TOOL_DECLARATIONS sent to Gemini
          ↓
  Gemini may return:  (a) text response
                   or (b) functionCall { name, args }

Turn 2 — If functionCall received:
  server validates name against TOOL_REGISTRY (whitelist)
          ↓
  [allowed]  server executes the registered function
          ↓
  server sends second request with functionResponse
          ↓
  Gemini returns final JSON insight

  [unknown name]  server rejects — no execution, returns fallback
```

* `TOOL_DECLARATIONS` (sent to Gemini) defines what the LLM may request.
* `TOOL_REGISTRY` (server-side map) defines what the server will actually execute.
* Only tool names present in `TOOL_REGISTRY` are executed — all others are rejected.
* File: `server/src/agent/agentTools.ts`

---

# 11. Request Validation

Validation is a middleware layer that runs between the router and the controller.

```text
HTTP request
    ↓
Route handler
    ↓
validate(schema)   ← middleware in validate.ts
    ↓
controller         ← only reached on valid input
```

* On invalid input: middleware responds with HTTP 400 and an error message.
* On valid input: middleware calls `next()` — the controller executes.
* Schemas are defined once in `validate.ts` and referenced by name in route files.

---

# 12. Testing Layers

FocusFlow separates tests into two distinct layers.

```text
Unit tests (npm test)
  └── src/tests/unit/
        ├── Isolated pure functions, no DB or HTTP
        └── Tools: vitest only

Integration tests (npm run test:integration)
  └── src/tests/integration/
        ├── Full HTTP route/middleware stack
        ├── Real Express app via testApp.ts
        ├── Mocked Mongoose models (no DB)
        └── Tools: vitest + supertest
```

The two layers demonstrate different concerns:
* Unit tests verify correctness of small deterministic functions.
* Integration tests verify that routing, middleware, and controllers interact correctly.

---

# 13. MongoDB Indexing

Indexes are defined in the Mongoose schema files alongside the field definitions.

```text
FocusSession collection
  ├── { userId: 1 }            ← single-field index
  │     used by: productivityAgent session lookup (by userId)
  │
  └── { userId: 1, taskId: 1 } ← compound index
        used by: analyzeProductivity (groups by taskId within userId)

Task collection
  └── { userId: 1 }  ← already defined with index: true in the schema
```

Unqueried fields (`status`, `duration`, `startedAt`) are not indexed because no query filters or sorts on these fields alone.




---
# 14. JWT Authentication Flow

Authentication relies on stateless JWTs issued upon login/registration.

```text
Client                  Server
  |                        |
  |--- POST /login ------->|
  |                        | verify credentials
  |<-- JWT (7d expiry) ----|
  |                        |
  |--- GET /tasks -------->|
  |    Authorization: Bearer <jwt>
  |                        | validate signature using config.JWT_SECRET
  |                        | extract user ID
  |<-- 200 OK -------------|
```


---
# 15. Backend Deployment

The architecture uses a Node.js/Express backend packaged via Docker.

```text
Git Repository
      |
  multi-stage Docker build (server/Dockerfile)
      |
Production Container (Node.js runtime)
      |
      |-- env: MONGODB_URI       --> External MongoDB
      |-- env: POSTGRES_URL      --> External PostgreSQL
      |-- env: GEMINI_API_KEY    --> Google Gemini API
```

Anticipated challenges:
*   **Environment Variables:** The container crashes gracefully if required DB strings aren't supplied at runtime.
*   **Build-time dependencies:** Using a multi-stage build eliminates TypeScript from the final image, reducing size and attack surface.


---
# 16. Gemini API Integration

FocusFlow integrates directly with the Google Gemini API using native Node `fetch`.

*   **Request Construction:** A prompt combining the user request and system instruction is sent along with `TOOL_DECLARATIONS`.
*   **Response Parsing:** Extracts JSON function calls or text content.
*   **Token Monitoring:** Reads `usageMetadata`.
*   **Error Handling:** In the event of network failure or missing API key, the system executes a deterministic fallback, ensuring the workflow continues. API keys are never hard-coded.


---
# 17. Controlled Form Handling

All forms in FocusFlow (Login, Task creation) employ the React Controlled Inputs pattern. 
Component state is strictly bound to input values via `value` and `onChange` handlers.


---
# 18. Validation Strategy

Validation occurs at both boundaries:
*   **Client:** React state-based validation gives instant feedback (e.g. password length).
*   **Backend:** Express middleware (`validate.ts`) guarantees integrity. Client validation does not replace backend validation.


---
# 19. Asynchronous UI States

Components fetching data maintain `isLoading` and `errorMsg` states, preventing blank screens or silent failures during network requests. The UI immediately reflects backend delays or downtimes.


---
# 20. Responsive Design

Layouts favor CSS Flexbox (e.g. `display: flex`). Embedded CSS media queries (e.g. `max-width: 600px`) adapt these directional layouts into vertical stacks on narrow viewports.


---
# 21. SQL Grouped Analytics

The `analytics_sessions` PostgreSQL table provides high-performance reporting. Queries filter down strictly to the requested user's workspace, group by foreign entities (tasks), sum metrics over sessions, and order natively at the DB level, preventing the application layer from caching and iterating over large session volumes.


---
# 22. Relational Indexes

Keys frequently used in analytic `JOIN` and `WHERE` clauses are explicitly backed by PostgreSQL B-tree Indexes, shifting performance bottlenecks away from sequential table scans.


---
# 23. Input Sanitization & Injection Defense Architecture

TaskFlow deploys a defense-in-depth sanitization architecture protecting against three distinct injection vectors:

```text id="sanitizationflow"
Inbound HTTP Request
       ↓
Express Middleware (sanitizeRequest)
       ├── NoSQL Sanitizer: Recursively removes keys with '$' prefix or '.' path separators
       └── Free-text Sanitizer: Strips/escapes HTML control chars (<, >, &, ", ')
       ↓
Validated Controller Layer
       ├── Strict Mongoose Schemas (Operational Store)
       └── Parameterized Prisma ORM Queries (Analytics Store)
```

1. **NoSQL Operator Injection Defense:** Express middleware intercepts request payloads before route execution, traversing objects recursively to delete keys starting with `$` (e.g. `{"$gt": ""}`) or containing `.`. This ensures attackers cannot subvert Mongoose query semantics.
2. **Cross-Site Scripting (XSS) Defense:** All user-supplied text (task titles, descriptions, subjects) is escaped to replace `< > & " '` with corresponding HTML entities.
3. **SQL Injection Defense:** All queries against the relational analytics store execute through Prisma ORM prepared statements or tagged template literals (`prisma.$queryRaw`), ensuring data cannot alter query structure.


---
# 24. Third-Party OAuth 2.0 Authentication Flow

TaskFlow implements the standard OAuth 2.0 Authorization Code flow with Google Identity Services:

```text id="oauthflow"
User               Browser / React Client         Express API Server            Google OAuth Service
 |                         |                              |                                |
 |-- Clicks "Google Login" |                              |                                |
 |------------------------>|                              |                                |
 |                         |-- GET /api/auth/google/url ->|                                |
 |                         |<-- Returns Google Auth URL --|                                |
 |                         |                              |                                |
 |                         |-- Redirects to Google consent screen ------------------------>|
 |                         |<-- User consents and Google redirects with authorization code -|
 |                         |                              |                                |
 |                         |-- POST /api/auth/google/callback (code) -------------------->|
 |                         |                              |-- Exchanges code for token --->|
 |                         |                              |<-- Returns user profile -------|
 |                         |                              |-- Upserts User in MongoDB -----|
 |                         |                              |-- Issues signed TaskFlow JWT --|
 |                         |<-- Returns { token, user } --|                                |
 |                         |                              |                                |
 |<-- Authenticated dashboard view -----------------------|                                |
```

*   **Security Nonce:** Consent URLs incorporate a cryptographically random `state` parameter to prevent CSRF attacks during the authorization redirect.
*   **Account Linking:** If a user registers via email/password and later authenticates via Google with the matching email, their account is unified under their verified Google ID without duplicating records.


---
# 25. Role-Based Access Control (RBAC) Architecture

TaskFlow enforces fine-grained authorization via role claims embedded directly in signed JWT tokens:

```text id="rbacflow"
Incoming Request
       ↓
authenticate Middleware
       ├── Verifies JWT signature and expiry
       └── Attaches req.user = { userId, name, role }
       ↓
requireRole('admin') Guard
       ├── req.user.role === 'admin'  ──> Next() ──> Controller
       └── req.user.role !== 'admin'  ──> 403 Forbidden
```

*   **Stateless Verification:** Because the user's role is encapsulated in the signed JWT payload, the authorization guard does not require a database lookup on every request, ensuring high performance.
*   **Separation of Concerns:** Authentication (`authenticate`) verifies *who the user is*; Authorization (`requireRole`) verifies *what the user is permitted to do*.


---
# 26. File Attachment Pipeline & Storage Architecture

File uploads are handled through a dedicated secure multipart processing pipeline:

```text id="uploadpipeline"
Client (multipart/form-data)
       ↓
Multer Middleware
       ├── Memory Buffer Validation (MIME type & extension whitelist)
       ├── File Size Enforcer (5MB limit -> HTTP 413)
       └── Disk Storage Engine
             └── Generates crypto.randomUUID() filename in /uploads
       ↓
Task Controller
       ├── Path Traversal Check (isSafeFilePath)
       └── Stores metadata in Task.attachments array (MongoDB)
```

*   **UUID Name Decoupling:** Original user filenames are stored only as display metadata in the database. On disk, files are stored strictly using generated UUIDs to eliminate filename collision, code execution via executable extensions, and directory enumeration.
*   **Path Traversal Prevention:** The `isSafeFilePath` utility checks that resolved absolute paths remain strictly within `config.UPLOAD_DIR`, rejecting traversal sequences like `../../etc/passwd`.


---
# 27. Frontend Production Deployment Architecture

The frontend client is packaged as a high-performance, containerized Single-Page Application (SPA) using multi-stage Docker builds and Nginx:

```text id="frontendarc"
Stage 1: Build (node:22-alpine)
       ├── Copies source and client/package.json
       ├── Executes `npm run build` (Vite + TypeScript)
       └── Emits compiled static bundle to /dist
Stage 2: Production (nginx:alpine)
       ├── Copies /dist to /usr/share/nginx/html
       ├── Copies client/nginx.conf
       └── Serves port 80 with Gzip and Security Headers
```

*   **SPA Route Fallback:** Nginx evaluates `try_files $uri $uri/ /index.html =404;`, ensuring client-side React Router paths (e.g. `/tasks/123`, `/dashboard`) resolve correctly on page refreshes without 404 errors.
*   **Security Hardening:** Nginx injects headers including `X-Frame-Options`, `X-Content-Type-Options`, and `X-XSS-Protection`.


---
# 28. Object-Relational Mapping (Prisma ORM) Architecture

TaskFlow employs Prisma ORM for PostgreSQL analytics, delivering end-to-end type safety, automated schema migrations, and declarative modeling:

```text id="prismaflow"
prisma/schema.prisma (Declarative Model)
       ↓
prisma generate
       ↓
@prisma/client (Generated Type-Safe Client)
       ├── Compile-time auto-completion & type checking
       ├── Parameter-bound query generation (SQL-injection immune)
       └── Connection pooling management
```

*   **Dual-Query Architecture:** The analytics layer maintains both raw node-postgres queries and Prisma ORM queries, demonstrating the trade-offs between low-level driver control and high-level ORM type safety.


---
# 29. Database Transaction Boundary Architecture

TaskFlow enforces strict database transaction boundaries when persisting completed focus sessions into the PostgreSQL analytics warehouse:

```text id="txboundaryflow"
POST /api/focus-sessions
       ↓
1. Operational Document Write (MongoDB FocusSession.save())
       ↓
2. PostgreSQL Analytics Sync Boundary (prisma.$transaction)
       ├── Step A: Upsert User (id, name)
       ├── Step B: Upsert Task (id, title, userId)
       └── Step C: Insert analytics_sessions (taskId, userId, duration, timestamps)
       └── On Error: All steps in PostgreSQL rollback cleanly (ACID Atomicity)
```

*   **Heterogeneous Database Boundary:** MongoDB and PostgreSQL are separate, uncoordinated database engines. A single local database transaction cannot span across both systems without distributed two-phase commit (2PC) or Saga orchestrators. TaskFlow explicitly encapsulates the transaction boundary inside PostgreSQL where relational integrity (foreign keys) is enforced.


---
# 30. Redis Cache-Aside & Invalidation Architecture

To offload analytical queries from PostgreSQL, TaskFlow integrates an in-memory Redis caching layer adhering to the Cache-Aside pattern:

```text id="cacheasideflow"
GET /api/analytics/time-by-task
       ↓
1. Check Redis: getCachedJson("analytics:user:${userId}:time-by-task")
       ├── [HIT]  ──> Set Header "X-Cache: HIT"  ──> Return Cached JSON
       └── [MISS] ──> Set Header "X-Cache: MISS"
                          ├── Query PostgreSQL via Prisma
                          ├── Write to Redis: setex(key, 300s, json)
                          └── Return Database JSON

POST /api/focus-sessions
       ↓
Save Session ──> invalidateCachePattern("analytics:user:${userId}:*")
                   └── Flushes stale analytics cache for consistent subsequent reads
```

*   **Offline Fallback:** If Redis is down or unreachable, the cache client logs a warning and routes queries directly to the PostgreSQL database without returning HTTP 500 errors.


---
# 31. Background Job Scheduling & Maintenance Architecture

TaskFlow manages asynchronous, periodic system maintenance using an in-process cron scheduler:

```text id="cronflow"
node-cron Scheduler (CLEANUP_CRON_SCHEDULE: "0 * * * *")
       ↓
Trigger runMaintenanceJob()
       ├── 1. Read files in /uploads directory
       ├── 2. Query MongoDB for active Task.attachments.filename
       ├── 3. For each unreferenced file:
       │         └── If file age > 24h grace period:
       │               └── fs.promises.unlink(filePath)
       └── 4. Return telemetry: { scanned, deleted, reclaimedBytes }
```

*   **Grace Period Safety:** Unreferenced files newer than the 24-hour retention threshold are preserved, ensuring ongoing multipart uploads are not inadvertently unlinked before their parent task is saved.


---
# 32. Real-Time WebSocket Synchronization Architecture

TaskFlow replaces polling with real-time push events via Socket.IO:

```text id="websocketflow"
Client A (Browser Tab 1)       Express + Socket.IO Server       Client B (Browser Tab 2)
       |                                   |                                   |
       |-- Connect (JWT Handshake) ------->|                                   |
       |    socket.join('user:101')        |                                   |
       |                                   |<-- Connect (JWT Handshake) -------|
       |                                   |    socket.join('user:101')        |
       |                                   |                                   |
       |-- POST /api/tasks (New Task) ---->|                                   |
       |                                   |-- emitTaskCreated('101', task) --|
       |<-- 'task:created' event ----------|                                   |
       |    (Updates React task state)     |-- 'task:created' event ---------->|
       |                                   |    (Updates React task state)     |
```

*   **Authentication Handshake:** Sockets authenticate during connection establishment via `socket.handshake.auth.token` or `headers.authorization`. Sockets without valid JWTs are rejected immediately.
*   **Room Isolation:** Every authenticated socket joins a dedicated private room `user:${userId}`. Event emissions target the user's room specifically, preventing data leakage across tenants.


---
# 33. Responsive UI Breakpoints & Mobile Viewport Adaptation

TaskFlow uses a mobile-first responsive architecture ensuring layout stability across viewports:

```text id="responsivebreakpoints"
Screen Width:
  0px ────────────── 600px ────────────────────── 1024px ────────────── 1440px+
 [Mobile Layout]          [Tablet / Narrow Laptop]       [Desktop View]
  • Cards stack vertically  • Auto-fit 2-column grid     • Multi-column grid
  • Full-width forms        • Wrap-enabled action bars   • Max-width 1000px container
  • Horizontal table scroll • Fluid typography (clamp)   • Fixed padding
```

*   **Table Horizontal Containment:** Broad tabular outputs (e.g. PostgreSQL time tracking) are encapsulated in `.table-responsive` wrappers with `overflowX: 'auto'` and `-webkit-overflow-scrolling: touch`, keeping table rows scrollable without bursting mobile document viewports.
*   **Fluid Typography & Spacing:** Key focal points (such as the focus timer) use CSS math functions (`fontSize: clamp(2.8rem, 12vw, 4.5rem)`) to dynamically adapt between small handhelds and large widescreen monitors.


---
# 34. MongoDB Multi-Stage Aggregation Pipeline Architecture

TaskFlow computes multi-dimensional analytics inside the database engine via `GET /api/tasks/stats`:

```text id="aggregationpipeline"
Raw Tasks Collection (MongoDB)
        │
   [Stage 1: $match] ──> Filter: { userId: ObjectId(req.user.userId) } (Tenant Isolation)
        │
   [Stage 2: $facet] ──> Executes 3 parallel sub-pipelines in a single database pass:
        │
        ├── byStatus:
        │     └── $group: { _id: "$status", count: { $sum: 1 } }
        │     └── $sort:  { count: -1 }
        │
        ├── byPriority:
        │     └── $group: { _id: "$priority", count: { $sum: 1 } }
        │     └── $sort:  { _id: 1 }
        │
        └── overview:
              ├── $project: { status: 1, attachmentCount: { $size: "$attachments" }, bytes: { $sum: "$attachments.size" } }
              ├── $group:   { totalTasks: { $sum: 1 }, completedTasks: { $cond: [...] }, attachmentBytes: { $sum: "$bytes" } }
              └── $project: { completionRate: { $round: [{ $multiply: [{ $divide: [...] }, 100] }, 1] }, ... }
```

*   **Performance & Ergonomics:** All grouping, summation, and arithmetic calculations occur inside the MongoDB query optimizer, returning pre-calculated telemetry in a single roundtrip rather than transferring large unaggregated document arrays over the network.


---
# 35. MongoDB Relational Modeling: Embedding vs Referencing

TaskFlow implements an explicit hybrid data modeling strategy:

```text id="relationshipmodeling"
+-------------------------------------------------------------------------------+
| Embedded Subdocuments (Bounded 1:Few)                                         |
| Task Document                                                                 |
|   ├── _id: ObjectId("65f1a2b3...")                                            |
|   ├── title: "Prepare Final Demo"                                             |
|   └── attachments: [                                                          |
|         { id: "uuid-1", originalName: "doc.pdf", filename: "...", size: 1024 }|
|       ]  <── Stored inline. Atomic updates with task. 0 additional queries.   |
+-------------------------------------------------------------------------------+
        │ (Referenced Foreign Key: unbounded 1:N)
        ▼
+-------------------------------------------------------------------------------+
| Referenced Entities (Unbounded 1:N)                                           |
| User Document                                                                 |
|   ├── _id: ObjectId("65f1a2b3...")                                            |
|   ├── name: "Alice Developer"                                                 |
|   └── email: "alice@example.com"                                              |
|                                                                               |
| FocusSession Document                                                         |
|   ├── _id: ObjectId("...")                                                    |
|   ├── taskId: ObjectId("65f1a2b3...")  <── Foreign Key Reference             |
|   └── userId: ObjectId("65f1a2b3...")  <── Foreign Key Reference             |
+-------------------------------------------------------------------------------+
```

*   **Embedding Rationale:** Attachments are strictly bounded (0 to ~10 items) and lifecycle-bound to their parent task. Embedding guarantees atomic persistence and single-read retrieval.
*   **Referencing Rationale:** Users create thousands of tasks and sessions. Storing tasks inside the `User` document would violate MongoDB's 16MB document size limit and cause extreme document churn. Normalization maintains clean query boundaries and independent indexing.


---
# 36. Payment Gateway Sandbox & Cryptographic Verification Flow

TaskFlow implements a secure sandbox payment flow verifying Razorpay-compatible HMAC-SHA256 signatures:

```text id="paymentflow"
Browser (Client)                     Express Backend                    Database
      │                                     │                               │
      │── 1. POST /api/payment/create-order ─>│                               │
      │      { plan: 'pro_monthly' }        │── 2. Create Payment Record ──>│
      │                                     │      (status: 'created')      │
      │<─ 3. Return { orderId, amount, key }─│                               │
      │                                     │                               │
      ├── 4. Simulate Sandbox Checkout      │                               │
      │                                     │                               │
      │── 5. POST /api/payment/verify ─────>│                               │
      │      { orderId, paymentId, sig }    │                               │
      │                                     │── 6. Server Signature Calc:   │
      │                                     │      HMAC-SHA256(order|pay,   │
      │                                     │                  secret)      │
      │                                     │                               │
      │                                     │── 7. crypto.timingSafeEqual() │
      │                                     │      ├── [MISMATCH] ──> 400   │
      │                                     │      └── [MATCH]              │
      │                                     │            ├── Update Payment │
      │                                     │            │   (status: paid) │
      │                                     │            └── Update User    │
      │                                     │                (isPro: true)  │
      │<─ 8. 200 OK { success: true } ───────│                               │
```

*   **Zero-Trust Client Boundary:** The server never trusts client status flags like `paymentSuccessful: true`. Upgrading to Pro requires valid mathematical proof matching the server secret.


---
# 37. Server-Side Rendering (SSR) Architecture & Component Pipeline

TaskFlow provides isolated server-side rendering using `ReactDOMServer.renderToString()` at `GET /ssr-demo`:

```text id="ssrflow"
Web Crawler / Browser Request (GET /ssr-demo)
       │
       ▼
Express Route Handler (ssrRoutes.ts)
       │
       ├── 1. Query MongoDB for task metrics (total, completed, pending)
       │
       ├── 2. Instantiate Pure React Component (renderTaskSummary.ts)
       │      React.createElement(TaskSummaryComponent, { totalTasks, ... })
       │
       ├── 3. Execute ReactDOMServer.renderToString(element)
       │      Synchronously emits HTML string containing rendered DOM
       │
       ├── 4. Embed into semantic HTML5 document template:
       │      <!DOCTYPE html>
       │      <html><head><title>...</title><style>...</style></head>
       │      <body><div id="root">${renderedMarkup}</div></body></html>
       │
       ▼
HTTP Response (Content-Type: text/html; charset=utf-8)
       └── Instant First Contentful Paint (FCP) + Full SEO crawler indexing
```

*   **Progressive Enhancement:** Crawlers and low-powered devices receive fully formed, styled HTML in the initial byte stream without requiring client-side bundle hydration.


