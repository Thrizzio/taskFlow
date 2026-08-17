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
