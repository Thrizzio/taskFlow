# Low-Level Design (LLD) - FocusFlow

## Viva / Technical Topic Mapping
| Topic | Implementation Location |
|---|---|
| Environment variables | `.env.example`, `server/src/utils/config.ts` |
| Git workflow | Repository branch structure and commit history |
| Client-side routing | `client/src/App.tsx`, `TaskDetail.tsx` (using `/:taskId`) |
| async/await | `server/src/controllers/`, `client/src/pages/` |
| Closures | `createTaskFilter` in `client/src/pages/Tasks.tsx` (production) + `timerClosure.ts` (demo) |
| Event loop | `client/src/features/javascript-concepts/EventLoopDemo.tsx` |
| Hoisting | `client/src/features/javascript-concepts/HoistingDemo.tsx` |
| Promises vs callbacks | `client/src/features/javascript-concepts/promisesVsCallbacks.ts` |
| Mongo schema modeling | `server/src/models/User.ts`, `Task.ts`, `FocusSession.ts` |
| SQL JOINs | `server/src/db/queries/analyticsQueries.ts` |

## Productivity Agent & LLM Mapping
| Concept | Implementation |
|---|---|
| Multi-step agent (orchestrator) | `server/src/agent/productivityAgent.ts` |
| Stage 1 — Planner | `server/src/agent/planner.ts` |
| Stage 2 — Analyzer | `server/src/agent/analyzer.ts` |
| Stage 3 — LLM Insight | `server/src/agent/llmInsight.ts` |
| Stage 4 — Recommender | `server/src/agent/recommender.ts` |
| Agent controller | `server/src/controllers/agentController.ts` |
| Agent route | `server/src/routes/agentRoutes.ts` |
| LLM API key config | `server/src/utils/config.ts` (`GEMINI_API_KEY`) |
| Closure factory | `createTaskFilter` in `client/src/pages/Tasks.tsx` |
| React closure integration | `Tasks.tsx` — second `useEffect` |
| Docker | `server/Dockerfile`, `server/.dockerignore` |

---

## Multi-Step Agent — Detailed Sequence

### Entry Point
`POST /api/agent/productivity` → `agentController.ts` → `runProductivityAgent(requestText, userId)`

### Stage 1 — Planner
- **File**: `server/src/agent/planner.ts`
- **Function**: `createPlan(request: string): Plan`
- **Input**: User's natural-language request string.
- **Output**: `Plan { goals: string[], timeframe?: string }` — a small analysis checklist.
- **Behavior**: Deterministic. Parses keywords (e.g., "week") to set a timeframe.

### Stage 2 — Analyzer
- **File**: `server/src/agent/analyzer.ts`
- **Function**: `analyzeProductivity(plan: Plan, sessions: any[]): Promise<AnalysisResult>`
- **Input**: `Plan` from Stage 1 + raw `FocusSession` documents from MongoDB.
- **Output**: `AnalysisResult { totalMinutes, sessionCount, topTask? }`
- **Behavior**: Sums durations, identifies top task by total focus time, resolves task title via `Task.findById`.

### Stage 3 — LLM Insight
- **File**: `server/src/agent/llmInsight.ts`
- **Function**: `getLlmInsight(analysis: AnalysisResult, userRequest: string): Promise<LlmInsight>`
- **Input**: `AnalysisResult` from Stage 2 + original user request string.
- **Output**: `LlmInsight { insight: string, priority: string, reason: string, source: 'llm' | 'fallback' }`
- **LLM Provider**: Google Gemini API (`gemini-2.0-flash-lite`)
- **Transport**: Native Node.js `fetch` (no SDK)
- **API Key**: `process.env.GEMINI_API_KEY` via `config.ts`
- **Prompt structure**:
  - System: instructs Gemini to return pure JSON with `insight/priority/reason` fields.
  - User: includes the user's request and the JSON-serialized `AnalysisResult`.
- **Response parsing**: `JSON.parse` on the raw text; validates three required string fields.
- **Error handling**:
  - Missing `GEMINI_API_KEY` → immediate fallback (no crash).
  - `response.ok === false` (HTTP error) → fallback.
  - JSON parse failure → fallback.
  - Network error (fetch throws) → fallback.
  - Fallback is a deterministic insight derived from `AnalysisResult` metrics.
  - **No API key or error details are leaked in the API response.**

### Stage 4 — Recommender
- **File**: `server/src/agent/recommender.ts`
- **Function**: `generateRecommendation(analysis: AnalysisResult, insight: LlmInsight): Promise<string>`
- **Input**: `AnalysisResult` from Stage 2 + `LlmInsight` from Stage 3.
- **Output**: Human-readable recommendation string incorporating the LLM's insight and priority.
- **Behavior**: Combines raw metric summary, LLM insight text, and a heuristic nudge into a single paragraph.

### Final Response
```json
{
  "success": true,
  "data": {
    "plan":           { "goals": [...], "timeframe": "week" },
    "analysis":       { "totalMinutes": 90, "sessionCount": 4, "topTask": "Math" },
    "insight":        { "insight": "...", "priority": "consistency", "reason": "...", "source": "llm" },
    "recommendation": "You had 90 minutes across 4 sessions. ..."
  }
}
```

### Error Propagation
- LLM failure: returns fallback `LlmInsight` (workflow continues normally, `source: "fallback"`).
- DB failure in Analyzer: exception propagates to `agentController`, which returns HTTP 500.
- Missing `request` body field: controller returns HTTP 400 before calling the agent.

---

## JavaScript Closure — Detailed Design

### Location
`client/src/pages/Tasks.tsx`

### Outer Function
```typescript
export function createTaskFilter(statusFilter: string) {
    // statusFilter is captured in the closure's lexical scope
    return function filterTask(task: Task): boolean {
        return statusFilter === 'all' || task.status === statusFilter;
    };
}
```

### Captured Variable
`statusFilter: string` — closed over by the returned `filterTask` function.  
After `createTaskFilter` returns, `filterTask` still has access to the `statusFilter` value that was in scope at call time. This is the closure.

### Returned Inner Function
`filterTask(task: Task): boolean` — applies the encapsulated filter to each task.

### React Integration
```typescript
useEffect(() => {
    const filter = createTaskFilter(statusFilter); // new closure created
    const filtered = tasks.filter(filter);         // closure applied
    setVisibleTasks(filtered);
}, [tasks, statusFilter]); // dependency array re-runs effect when either changes
```

### Why the useEffect Dependency Array Matters
The dependency array `[tasks, statusFilter]` causes React to re-run the effect whenever `statusFilter` changes.  
This means a **new closure** is created on each change, so `filterTask` always captures the **current** value.  
The dependency array is what prevents the effect from using an outdated `statusFilter` — closures themselves do not prevent stale state; the dependency array manages re-execution.

### Why This Is a Genuine Closure
`filterTask` is defined inside `createTaskFilter`. After `createTaskFilter` returns, `filterTask` retains a reference to the `statusFilter` variable from its enclosing lexical scope — this satisfies the definition of a closure. The function is not merely receiving `statusFilter` as a parameter; it retains access to the outer scope's binding.

---

## Project Structure
```text
server/
  src/
    index.ts
    utils/config.ts
    agent/
      productivityAgent.ts   ← orchestrator (4 stages)
      planner.ts
      analyzer.ts
      llmInsight.ts          ← NEW: Gemini LLM stage
      recommender.ts
    controllers/
    routes/
    models/ (Mongoose)
    db/
      pg.ts
      queries/analyticsQueries.ts

client/
  src/
    App.tsx
    pages/
      Tasks.tsx              ← closure integration (createTaskFilter)
    features/
      timer/
        timerClosure.ts      ← conceptual demo
      javascript-concepts/
```

## Database Schemas
### MongoDB (Mongoose)
- **User**: `{ _id, email, passwordHash, name }`
- **Task**: `{ _id, title, status, priority, userId, createdAt }`
- **FocusSession**: `{ _id, taskId, userId, duration, startedAt, endedAt, status }`

### PostgreSQL
- **users**: `id, name`
- **tasks**: `id, title, user_id`
- **analytics_sessions**: `id, task_id, user_id, duration, started_at, ended_at`
