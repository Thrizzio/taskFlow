# Product Requirements Document (PRD) — FocusFlow

## 1. Problem Statement

Students need a simple, distraction-free tool to manage tasks, track focused work sessions, and review their productivity without unnecessary complexity.

## 2. Target Users

Students and developers who want a straightforward productivity tracker to build consistent focused-work habits.

## 3. Product Goals

* Make task management simple.
* Allow users to track focused work through timed sessions.
* Provide clear productivity analytics.
* Provide concise, actionable productivity recommendations using an LLM workflow.
* Demonstrate sound engineering practices and technical concepts.

## 4. Non-Goals

FocusFlow does not aim to provide:

* Social networking features (feeds, follows, public comments)
* Live production payment processing with real monetary charges (a sandbox/test-mode payment gateway with cryptographic verification is provided for the engineering rubric)
* Multi-user concurrent document co-editing (single-user real-time device sync is supported)
* Native mobile push notifications
* Fully autonomous AI agents with dynamic tool selection

---

# 5. User Stories

1. As a student, I want to register and log in securely.
2. As a student, I want to create, edit, and complete tasks.
3. As a student, I want to filter tasks by status.
4. As a student, I want to run a focus session with start, pause, resume, and completion states.
5. As a student, I want to see how much time I spent on each task.
6. As a student, I want FocusFlow to analyze my focus sessions and provide a concise recommendation about where I can improve.

---

# 6. MVP Functional Requirements

### Authentication

* Registration and login.
* Input validation.
* JWT-based authentication.
* Protected application functionality for authenticated users.

### Task Management

* Create, view, edit, and complete tasks.
* Filter tasks by `all`, `pending`, or `completed`.

### Focus Timer

* Select a task and start a focus session.
* Support `Idle`, `Running`, `Paused`, and `Completed` states.
* Persist completed sessions and their duration.

### Analytics

* Display productivity information based on recorded focus sessions.
* Provide time-spent information per task.

### Productivity Recommendations

* Accept a natural-language productivity request.
* Analyze the user's focus-session data.
* Return a concise, actionable recommendation.
* Expose the intermediate analysis results for transparency.

### JavaScript Concepts

Provide a dedicated `/javascript-concepts` area containing demonstrations of:

* Event loop
* Hoisting
* Promises vs callbacks

---

# 7. Multi-Step Productivity Workflow

## Problem

Collecting productivity data is useful, but users may need help interpreting the data and identifying areas for improvement.

## Feature

FocusFlow provides a four-stage server-side workflow that converts a user's productivity request and focus-session data into an actionable recommendation.

### Workflow

1. **Planner** — Converts the user's request into a structured analysis plan.
2. **Analyzer** — Calculates relevant productivity metrics from focus-session data.
3. **LLM Insight** — Uses Gemini to interpret the structured metrics.
4. **Recommender** — Combines the metrics and insight into a final recommendation.

### Requirements

* The workflow must execute server-side.
* It must be accessible through `POST /api/agent/productivity`.
* The system must continue functioning with a deterministic fallback if the LLM is unavailable.
* The API response should expose the plan, analysis, insight, and recommendation.
* The workflow is a **multi-step LLM workflow**, not a fully autonomous agent because the LLM does not dynamically select tools or determine its own execution path.

---

# 8. Technical Requirements

The project should demonstrate the following engineering concepts:

| Requirement           | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| Environment variables | Keep configuration and secrets outside source code         |
| Git workflow          | Maintain organized development history                     |
| Client-side routing   | Support application navigation and protected/dynamic pages |
| async/await           | Handle asynchronous application operations                 |
| Closures              | Demonstrate encapsulated JavaScript behavior               |
| Event loop            | Demonstrate JavaScript asynchronous execution              |
| Hoisting              | Demonstrate JavaScript declaration behavior                |
| Promises vs callbacks | Demonstrate asynchronous programming patterns              |
| Mongo schema modeling | Store operational application data                         |
| SQL JOINs             | Combine relational data for analytics                      |

---

# 9. MVP Success Criteria

The MVP is successful when an authenticated user can:

1. Create and manage tasks.
2. Filter tasks by status.
3. Complete timed focus sessions.
4. View time-spent analytics.
5. Submit a productivity request.
6. Receive a recommendation based on their focus-session data.
7. Continue receiving a valid response when the LLM service is unavailable.

---

# 10. LLM Evaluation

## Problem

An LLM-backed workflow may produce incorrect or low-quality output. Without a structured evaluation mechanism, regressions are hard to detect.

## Capability

FocusFlow includes a small evaluation set for the productivity workflow. The evaluation set covers representative input scenarios (no sessions, low volume, high volume). Each case defines reference criteria against which the returned insight and recommendation are assessed.

## Requirements

* The evaluation must not modify production data.
* Pass/fail results must be deterministic for the fallback path.
* Results must be runnable independently of the main application.

---

# 11. Token and Cost Monitoring

## Problem

External LLM calls consume tokens and incur cost. Without monitoring, these cannot be tracked, debugged, or optimized.

## Capability

FocusFlow records token usage and estimated cost for every Gemini call made during the productivity workflow. This information is returned alongside the insight and recommendation in the API response.

## Requirements

* Token counts must come from the actual Gemini response rather than approximations.
* Pricing assumptions must be defined in one configurable location.
* When the fallback path is used (no API call made), usage must be reported as zero tokens and zero cost.

---

# 12. Controlled Tool Calling

## Problem

The LLM stage can produce better-grounded insights if it can request structured data, but unrestricted LLM function execution is a security risk.

## Capability

The productivity-agent LLM stage supports a controlled tool-calling mechanism. The server defines a fixed whitelist of one tool (`getProductivitySummary`). The LLM may request this tool; the server validates the name against the registry, executes the corresponding server-side function, and returns the result to the LLM. The LLM cannot request arbitrary code execution.

## Requirements

* Tool definitions must be declared explicitly with name, description, and argument schema.
* The server must reject any tool name not in the registry.
* The tool result must be returned to the LLM in a second request.
* The LLM must not be able to execute arbitrary functions or code.

---

# 13. Request Body Validation

## Problem

Without input validation, malformed requests can reach business logic or produce unhelpful errors.

## Capability

FocusFlow validates request bodies before controllers execute. Invalid input returns HTTP 400 with a descriptive error message. Four endpoints are validated: registration, login, task creation, and the productivity-agent request.

## Requirements

* Validation must occur before controller logic runs.
* Invalid input must return HTTP 400.
* Validation must be defined in one reusable location.

---

# 14. Testing Requirements

## Problem

Without automated tests, regressions are hard to catch and behavior is difficult to demonstrate.

## Capability

FocusFlow has two test layers:

* **Unit tests** — test small, isolated, deterministic functions (closure, planner, tool dispatch, cost formula). No DB or network required.
* **Integration tests** — test real HTTP routes and middleware behavior (auth, validation, task CRUD) using supertest. DB is mocked.

Both layers run with `npm test` and `npm run test:integration` respectively.

## Requirements

* Unit tests must not require database connections.
* Integration tests must not require a real database or Gemini API key.
* Tests must fail clearly when behavior changes.

---

# 15. MongoDB Indexing

## Problem

As session counts grow, unindexed queries against large collections degrade performance.

## Capability

FocusFlow adds explicit MongoDB indexes to the `FocusSession` collection on the fields used by the analytics and agent queries. The `Task.userId` index already exists.

## Requirements

* Indexes must correspond to actual query patterns.
* Unnecessary indexes must be avoided.
* Index definitions must be co-located with the Mongoose schema.




---
# 16. JWT Issuance & Verification

## Purpose
Stateful user sessions require database lookups on every request, which is inefficient. FocusFlow uses JSON Web Tokens (JWT) for stateless authentication.

## Requirements
*   Tokens must be signed with a secure secret loaded from config.
*   Tokens must contain non-sensitive identity claims (user ID, name).
*   Requests must include the token in the `Authorization` header.
*   Invalid or missing tokens must receive a 401 response.


---
# 17. Backend Deployment Strategy

## Purpose
To provide a reproducible, environment-agnostic production deployment model.

## Requirements
*   The backend must be containerized using Docker.
*   The container must not hold state or secrets.
*   Database connections (MongoDB, PostgreSQL) must be external and configurable.


---
# 18. 3rd-Party API Integration (Gemini)

## Purpose
To leverage an advanced LLM (Google Gemini) for unstructured productivity insight generation, returning zero tokens when missing credentials to avoid failure.


---
# 19. Controlled Form Inputs

## Purpose
Ensure that React acts as the single source of truth for user input, providing immediate responsiveness and synchronisation with layout state.


---
# 20. Client-Side Form Validation

## Purpose
To improve UX by catching obvious invalid inputs (e.g., short passwords) instantly before waiting for server responses.

## Requirements
*   Client validation enhances UX.
*   Backend validation remains the fundamental security/trust boundary.


---
# 21. Loading & Error UI States

## Purpose
Prevent user confusion during asynchronous network operations by clearly denoting activity and failure.

## Requirements
*   Display explicit loading indicators during API calls.
*   Display human-readable error messages on failure.


---
# 22. Responsive Layout

## Requirement
The application must present a usable interface across desktop, tablet, and mobile orientations without requiring a full desktop viewport.


---
# 23. PostgreSQL Grouping & Ordering

## Purpose
To provide sophisticated user-level analytic reports leveraging native relational grouping logic.


---
# 24. PostgreSQL Indexing

## Purpose
To maintain fast analytic query times even as session logs grow exponentially.


---
# 25. Input Sanitization & Injection Awareness

## Purpose
Protect application databases and clients against NoSQL operator injection, SQL injection, and Stored/Reflected Cross-Site Scripting (XSS).

## Requirements
*   Strip dangerous MongoDB query operators (`$` prefix and `.` path separators) from request bodies, parameters, and query strings.
*   Escape HTML control characters (`<`, `>`, `&`, `"`, `'`) on free-text inputs before database persistence.
*   Enforce parameter binding on all relational queries to eliminate SQL injection attack vectors.
*   Enforce field allowlists on update endpoints to prevent unexpected schema mutation.


---
# 26. Third-Party OAuth 2.0 Authentication

## Purpose
Allow users to sign up and authenticate frictionlessly using their existing Google identity credentials while avoiding plaintext credential exposure.

## Requirements
*   Provide a standardized OAuth 2.0 Authorization Code exchange flow with Google Identity Services.
*   Expose `GET /api/auth/google/url` returning the configured authorization consent URL with state nonce.
*   Expose `POST /api/auth/google/callback` to securely exchange the authorization code for verified Google user profiles.
*   Auto-provision new accounts or link existing accounts by email address, issuing a standard TaskFlow JWT.
*   Provide fallback error states when credentials or network exchanges fail.


---
# 27. Role-Based Access Control (RBAC)

## Purpose
Enforce strict authorization boundaries separating standard application users from administrative operators.

## Requirements
*   Support explicit user roles: `user` (default) and `admin`.
*   Embed user roles directly into signed JWT claims to permit fast, stateless middleware verification.
*   Provide an extensible `requireRole('admin')` Express route guard.
*   Unauthenticated requests must return HTTP 401 Unauthorized; authenticated users lacking necessary roles must return HTTP 403 Forbidden.
*   Expose admin-only operational endpoints (`GET /api/admin/overview`, `GET /api/admin/users`).


---
# 28. File Upload Handling & Storage Security

## Purpose
Enable users to attach relevant study materials, notes, and documents to tasks securely without exposing the server to remote code execution or storage exhaustion.

## Requirements
*   Accept file uploads via `multipart/form-data` on task detail views (`POST /api/tasks/:taskId/attachments`).
*   Enforce file size limits (5 MB maximum per attachment).
*   Enforce strict MIME-type and file extension whitelisting (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.txt`, `.md`).
*   Store files on disk using cryptographically random UUID filenames to prevent file overwrite attacks and directory enumeration.
*   Enforce path traversal prevention checks (`isSafeFilePath`) before serving or deleting files.
*   Provide download (`GET /api/tasks/:taskId/attachments/:attachmentId`) and deletion endpoints with ownership checks.


---
# 29. Production Frontend Deployment

## Purpose
Provide a production-grade, containerized frontend distribution optimized for cloud environments, high availability, and low latency.

## Requirements
*   Build a standalone multi-stage Docker container (`client/Dockerfile`) compiling React + Vite TypeScript into static assets.
*   Serve production assets using Nginx with Single-Page Application (SPA) routing fallback (`try_files $uri $uri/ /index.html`).
*   Configure essential HTTP security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`).
*   Enable asset caching with immutable cache headers for hashed static bundles.
*   Provide parameterized runtime environment configuration via `VITE_API_URL`.


---
# 30. Object-Relational Mapping (Prisma ORM)

## Purpose
Provide type-safe schema modeling, automatic migration management, and compile-time query verification for the PostgreSQL analytics database.

## Requirements
*   Define a declarative relational schema (`server/prisma/schema.prisma`) modeling Users, Tasks, and Analytics Sessions with strict foreign keys and cascading delete rules.
*   Generate a strongly typed client (`@prisma/client`) providing end-to-end type safety in query code.
*   Provide parallel ORM implementations alongside raw SQL queries to benchmark performance and developer ergonomics.


---
# 31. Database Transactions (ACID Persistence)

## Purpose
Guarantee data integrity across multi-entity persistence operations in the analytics store, ensuring no orphaned or partial records exist if failures occur.

## Requirements
*   Wrap multi-step analytics sync operations (User upsert, Task upsert, Analytics Session insertion) in an atomic `prisma.$transaction`.
*   Enforce all ACID properties: Atomicity (all succeed or all roll back), Consistency (foreign key references maintained), Isolation (uncommitted writes invisible to concurrent queries), and Durability (committed writes persisted to disk).
*   Encapsulate transaction boundaries explicitly within the PostgreSQL store, isolating it from MongoDB operational documents.


---
# 32. Redis Caching Layer

## Purpose
Accelerate repeated read-heavy analytics queries, reduce PostgreSQL load, and improve API response latency using an in-memory Cache-Aside pattern.

## Requirements
*   Implement the Cache-Aside pattern on `GET /api/analytics/time-by-task`:
    *   Check Redis for key `analytics:user:${userId}:time-by-task`.
    *   On Cache HIT: Return cached data immediately with response header `X-Cache: HIT`.
    *   On Cache MISS: Execute the relational query, write the result to Redis with a configurable TTL (default 300s), and return with header `X-Cache: MISS`.
*   Implement proactive Cache Invalidation: Purge user analytics keys whenever new focus sessions are recorded (`POST /api/focus-sessions`).
*   Ensure offline resilience: Gracefully fall back to direct database execution without failing requests if Redis is unavailable.


---
# 33. Scheduled Maintenance Jobs (Cron)

## Purpose
Automate recurring background housekeeping tasks to prevent disk bloat and purge abandoned or orphaned file attachments.

## Requirements
*   Schedule recurring background execution using `node-cron` with configurable cron expressions (default hourly: `0 * * * *`).
*   Identify orphaned files: Files physically present on disk in the storage directory that are no longer referenced in any task's attachment list in MongoDB.
*   Enforce a safety grace period (default 24h) before deletion to avoid removing in-flight concurrent uploads.
*   Provide fail-safe error handling: Skip deletions if the database query fails to prevent accidental data loss.
*   Export manual trigger capability (`runMaintenanceJob()`) returning execution telemetry (`scanned`, `deleted`, `reclaimedBytes`).


---
# 34. Real-Time WebSocket Synchronization

## Purpose
Provide instant, low-latency UI synchronization across browser tabs and devices whenever tasks are modified or focus sessions are completed, without inefficient HTTP polling.

## Requirements
*   Integrate Socket.IO server on top of the Express HTTP server.
*   Authenticate WebSocket connection handshakes using JWT bearer tokens; reject unauthenticated sockets before connection establishment.
*   Enforce user room isolation: Automatically route connected sockets into private user rooms (`user:${userId}`); prevent cross-user message leakage.
*   Emit real-time events on task lifecycle changes (`task:created`, `task:updated`, `task:deleted`) and session completion (`focus:completed`).
*   Client integration: Connect via `SocketContext`, update React state optimistically on incoming events, and display real-time connection status indicators.


---
# 35. Responsive Layout & Styling Competence

## Purpose
Ensure all core application interfaces render seamlessly across device form factors from mobile viewports (320px) to wide desktop displays (1440px+) without horizontal clipping, overlapping controls, or broken text.

## Requirements
*   **Mobile Viewport Adaptation (< 600px)**:
    *   Task cards stack vertically (`flex-direction: column !important; align-items: flex-start !important`).
    *   Task creation forms convert to full-width vertical inputs.
    *   Action buttons across Task Detail and Focus screens wrap gracefully (`flexWrap: 'wrap'`).
*   **Table Overflow Protection**:
    *   Wrap data tables (e.g. Analytics PostgreSQL time report) inside dedicated scroll containers (`overflowX: 'auto'`, `-webkit-overflow-scrolling: touch`) preventing page-level horizontal overflow.
*   **Fluid Typography & Controls**:
    *   Use CSS `clamp()` for timer displays (`clamp(2.8rem, 12vw, 4.5rem)`) and container padding (`clamp(1rem, 4vw, 2rem)`) to prevent layout clipping on small screens while remaining proportional on desktop.


---
# 36. MongoDB Aggregation Pipelines

## Purpose
Execute multi-stage analytical queries within the database engine using MongoDB's aggregation framework, computing grouped statistics, attachment summaries, and completion metrics without pulling unaggregated raw datasets into application memory.

## Requirements
*   Expose `GET /api/tasks/stats` protected by JWT authentication.
*   Enforce strict tenant isolation as the initial pipeline stage (`$match: { userId: ObjectId(req.user.userId) }`).
*   Execute parallel multi-dimensional analytics using `$facet`:
    *   `byStatus`: `$group` counts by status (`completed`, `pending`), sorted descending.
    *   `byPriority`: `$group` counts by priority (`high`, `medium`, `low`), sorted by priority name.
    *   `overview`: Multi-stage pipeline computing:
        *   `$project`: extract attachment count via `$size` and byte sum.
        *   `$group`: aggregate `totalTasks`, `completedTasks`, `pendingTasks`, `totalAttachments`, and `totalAttachmentBytes` using `$cond` and `$sum`.
        *   `$project`: calculate `completionRate` using arithmetic operators (`$multiply`, `$divide`, `$round`).
*   Return predictable fallback zeros for users with zero tasks.


---
# 37. MongoDB Embedding vs Referencing Relationships

## Purpose
Apply deliberate NoSQL data modeling patterns, choosing between embedded subdocuments and referenced normalized entities based on cardinality, lifecycle dependencies, and MongoDB's 16MB BSON document boundary.

## Requirements
*   **Embedded Subdocuments (`Task.attachments`)**:
    *   *Cardinality*: 1-to-few bounded (0 to ~10 attachments per task).
    *   *Lifecycle*: Attachments belong strictly to a single task; deleted automatically when the parent task is removed.
    *   *Performance*: Embedded inline, allowing single-query document retrieval without expensive multi-collection `$lookup` joins.
*   **Referenced Entities (`Task.userId` -> `User`, `FocusSession.taskId` -> `Task`)**:
    *   *Cardinality*: 1-to-unbounded (a user can create thousands of tasks and sessions).
    *   *Lifecycle*: Independent entity lifecycles. Storing tasks inside `User` documents would violate the 16MB document limit and introduce severe write contention.
    *   *On-Demand Population*: Provide `GET /api/tasks/:taskId?populate=user` to dynamically resolve foreign keys using Mongoose `.populate('userId', 'name email role')`.


---
# 38. Payment Gateway Integration (Sandbox / Test Mode)

## Purpose
Provide a secure, cryptographically verified checkout and subscription upgrade flow for the Pro tier using a test-mode payment gateway (Razorpay sandbox protocol) without accepting unverified client-side claims.

## Requirements
*   **Order Creation (`POST /api/payment/create-order`)**:
    *   Generate a unique server-side sandbox order identifier (`order_sbx_${timestamp}_${randomId}`).
    *   Store an unverified `Payment` record with status `'created'`, associated plan, amount in smallest currency unit (e.g. 49900 paise = ₹499.00), and currency `'INR'`.
*   **Cryptographic Signature Verification (`POST /api/payment/verify`)**:
    *   Require `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`.
    *   Compute server-side HMAC-SHA256 of `order_id + "|" + payment_id` using `RAZORPAY_KEY_SECRET`.
    *   Validate signature using timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
    *   **NEVER** trust client-supplied status flags like `paymentSuccessful: true`.
    *   On valid signature: update payment to `'paid'` and upgrade user account (`User.isPro = true`).
    *   On tampered or invalid signature: update payment to `'failed'` and respond with HTTP 400 Bad Request.
*   **Offline Testability**:
    *   Support deterministic offline mock keys and automated testing without live network calls to third-party payment servers.


---
# 39. Server-Side Rendering (ReactDOMServer)

## Purpose
Demonstrate server-side rendering (SSR) of React components to achieve instant First Contentful Paint (FCP) and optimal search engine crawler indexing (SEO) without requiring client JavaScript hydration.

## Requirements
*   Expose `GET /ssr-demo` serving a complete HTML5 document.
*   Render React component markup synchronously on the Node.js backend using `ReactDOMServer.renderToString()`.
*   Interpolate live productivity summary telemetry (total tasks, completed tasks, pending tasks) directly into the rendered markup.
*   Embed standard SEO `<meta>` tags (title, description, robots, viewport) and scoped CSS within the delivered `<head>`.
*   Include graceful offline fallbacks ensuring the endpoint renders valid HTML even when the operational database is temporarily unreachable.


