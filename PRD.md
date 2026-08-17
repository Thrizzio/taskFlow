# Product Requirements Document (PRD) - FocusFlow

## Problem Statement
Students need a simple, distraction-free tool to track tasks, manage timed focus sessions, and review productivity data without artificial complexity.

## Target User
Students and developers who want a straightforward productivity tracker to build focused work habits.

## Goals
- Provide easy task recording with status-based filtering.
- Provide a timer for focus sessions.
- Provide clear analytics on time spent.
- Provide an intelligent productivity recommendation via a multi-stage LLM workflow.
- Maintain a clean codebase to demonstrate technical concepts.

## Non-Goals
- Social features, payments, real-time collaboration, push notifications.
- Fully autonomous AI agents with dynamic tool selection.

## User Stories
1. As a student, I want to sign up and log in securely.
2. As a student, I want to create, edit, and complete tasks.
3. As a student, I want to filter my task list by status (all / pending / completed).
4. As a student, I want to select a task and run a timer session (start/pause/resume/complete).
5. As a student, I want to view my time spent per task on an analytics dashboard.
6. As a student, I want FocusFlow to analyze my focus sessions and give me a concise, LLM-informed recommendation so I can understand where to improve.

## MVP Scope & Functional Requirements
- **Authentication:** Registration, login, validation. JWT based.
- **Task Management:** CRUD operations on task items.
- **Task Filtering:** Status filter (all / pending / completed) on the Tasks page. The filter is implemented using a JavaScript closure factory (`createTaskFilter`) inside a React `useEffect`, so the filter function always captures the current filter value.
- **Focus Timer:** Timer UI with core states (Idle, Running, Paused, Completed).
- **Session Tracking:** Persist sessions and duration upon completion.
- **Analytics:** Dashboard showing time-per-task utilizing PostgreSQL for data shaping.
- **Productivity Agent:** Multi-stage LLM workflow (see below).
- **Language Concepts:** Dedicated route `/javascript-concepts` for technical demonstrations.

## Technical-Rubric Mapping
1. **Environment Variables**: `.env` and `config.ts` loading and validation.
2. **Git Workflow**: Conventional commits per feature phase.
3. **Client-side Routing**: React Router with protected routes and dynamic params (`/tasks/:taskId`).
4. **JS - async/await**: APIs, database controllers.
5. **JS - Closures**: `createTaskFilter` in `Tasks.tsx` (production use) + `timerClosure.ts` (conceptual demo).
6. **JS - Event Loop**: Demo page (`EventLoopDemo.tsx`).
7. **JS - Hoisting**: Demo page (`HoistingDemo.tsx`).
8. **JS - Promises vs Callbacks**: Demo utility `promisesVsCallbacks.ts`.
9. **Mongo Schema Modeling**: Used for operational app data (`users`, `tasks`, `focus_sessions`).
10. **SQL JOINs**: PostgreSQL `analytics_sessions` joined with `users` and `tasks` for analytical reporting.

## Multi-Step Productivity Agent

### Problem
Users can collect productivity data but may struggle to interpret it.

### Feature
A four-stage LLM workflow that analyzes the user's focus session data, sends structured metrics to Gemini for interpretation, and returns an actionable recommendation.

### User Story
"As a student, I want FocusFlow to analyze my focus sessions and give me a concise recommendation so I can understand where to improve."

### Workflow Stages
1. **Planner** — Converts the user's natural-language request into a structured analysis plan (deterministic).
2. **Analyzer** — Computes structured metrics from MongoDB focus sessions (total minutes, session count, top task).
3. **LLM Insight** — Sends metrics to the Gemini API; receives a structured `{ insight, priority, reason }` object.
4. **Recommender** — Combines analyzer metrics with the LLM insight to produce a final human-readable recommendation.

### Notes
- The workflow is intentionally prototype-scoped and runs server-side via `POST /api/agent/productivity`.
- If `GEMINI_API_KEY` is not configured, the LLM stage returns a deterministic fallback insight — the four-stage flow is always present.
- All intermediate artifacts (`plan`, `analysis`, `insight`, `recommendation`) are returned in the API response for transparency.
- This is accurately described as a **multi-step LLM workflow**, not a fully autonomous agent (the LLM does not dynamically select tools).
