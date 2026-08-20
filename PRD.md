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

* Social features
* Payments
* Real-time collaboration
* Push notifications
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
