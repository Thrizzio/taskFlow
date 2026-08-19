# High-Level Design (HLD) — FocusFlow

## 1. System Architecture

FocusFlow uses a client-server architecture:

```text id="hldarch"
React Client
    ↓ REST / JSON
Node.js + Express Server
    ├── MongoDB (operational data)
    ├── PostgreSQL (analytics/reporting)
    └── Google Gemini API (LLM insights)
```

### Components

* **Client:** React + Vite + TypeScript + React Router. Handles UI state, routing, and API communication.
* **Server:** Node.js + Express. Handles authentication, business logic, database access, and agent orchestration.
* **MongoDB:** Mongoose-based operational storage for users, tasks, and focus sessions.
* **PostgreSQL:** Structured storage for analytics and reporting.
* **Gemini:** External LLM used only by the productivity-agent LLM stage.

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

