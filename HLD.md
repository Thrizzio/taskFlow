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

The server is containerized using:

* `server/Dockerfile`
* `server/.dockerignore`

MongoDB and PostgreSQL remain external services.

Environment-specific values such as `GEMINI_API_KEY` are supplied through environment variables rather than committed to the repository.

The architecture is designed to support deployment on platforms such as Render or Heroku.

---

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

