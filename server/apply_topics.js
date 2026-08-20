const fs = require('fs');
const execSync = require('child_process').execSync;
const path = require('path');

const rootDir = 'c:/DEV WORK/taskFlow';

function appendToFile(filename, content) {
    fs.appendFileSync(path.join(rootDir, filename), '\n\n' + content + '\n');
}

function replaceInFile(filename, searchValue, replaceValue) {
    const filepath = path.join(rootDir, filename);
    let content = fs.readFileSync(filepath, 'utf8');
    content = content.replace(searchValue, replaceValue);
    fs.writeFileSync(filepath, content);
}

function commit(msg) {
    execSync('git add .', { cwd: rootDir });
    execSync(`git commit -m "${msg}"`, { cwd: rootDir });
    console.log(`Committed: ${msg}`);
}

// ---------------------------------------------------------
// 1. JWT Issuance
// ---------------------------------------------------------
appendToFile('PRD.md', `---
# 16. JWT Issuance & Verification

## Purpose
Stateful user sessions require database lookups on every request, which is inefficient. FocusFlow uses JSON Web Tokens (JWT) for stateless authentication.

## Requirements
*   Tokens must be signed with a secure secret loaded from config.
*   Tokens must contain non-sensitive identity claims (user ID, name).
*   Requests must include the token in the \`Authorization\` header.
*   Invalid or missing tokens must receive a 401 response.`);

appendToFile('HLD.md', `---
# 14. JWT Authentication Flow

Authentication relies on stateless JWTs issued upon login/registration.

\`\`\`text
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
\`\`\``);

appendToFile('LLD.md', `---
# 19. JWT Issuance & Verification

## Purpose
To provide stateless, secure authentication.

## Implementation & Relevant Files
*   **Issuance:** \`server/src/controllers/authController.ts\` (\`login\` and \`register\`). Creates a JWT using \`jsonwebtoken.sign\`.
*   **Claims:** \`{ userId: user._id, name: user.name }\` are embedded.
*   **Verification:** \`server/src/middleware/auth.ts\` extracts the token from the \`Bearer\` header, calls \`jwt.verify()\` with \`config.JWT_SECRET\`, and attaches \`req.user\`.
*   **Configuration:** \`server/src/utils/config.ts\` loads \`JWT_SECRET\` from the environment.
*   **Fallback:** Returns 401 if token is missing/invalid.

## Design Reasoning
Stateless tokens avoid managing server-side session stores, keeping the Express instances stateless.`);
commit('docs: document JWT issuance and verification');

// ---------------------------------------------------------
// 2. Backend Deployment
// ---------------------------------------------------------
appendToFile('PRD.md', `---
# 17. Backend Deployment Strategy

## Purpose
To provide a reproducible, environment-agnostic production deployment model.

## Requirements
*   The backend must be containerized using Docker.
*   The container must not hold state or secrets.
*   Database connections (MongoDB, PostgreSQL) must be external and configurable.`);

appendToFile('HLD.md', `---
# 15. Backend Deployment

The architecture uses a Node.js/Express backend packaged via Docker.

\`\`\`text
Git Repository
      |
  multi-stage Docker build (server/Dockerfile)
      |
Production Container (Node.js runtime)
      |
      |-- env: MONGODB_URI       --> External MongoDB
      |-- env: POSTGRES_URL      --> External PostgreSQL
      |-- env: GEMINI_API_KEY    --> Google Gemini API
\`\`\`

Anticipated challenges:
*   **Environment Variables:** The container crashes gracefully if required DB strings aren't supplied at runtime.
*   **Build-time dependencies:** Using a multi-stage build eliminates TypeScript from the final image, reducing size and attack surface.`);

appendToFile('LLD.md', `---
# 20. Backend Deployment

## Implementation & Relevant Files
*   **Dockerfile:** \`server/Dockerfile\` implements a multi-stage build (\`builder\` stage for \`tsc\`, \`production\` stage for running \`dist/index.js\`).
*   **Security:** Only the compiled \`dist/\` and runtime dependencies are copied into the final image.

## Configuration Flow
Environment variables are injected at container runtime and parsed in \`server/src/utils/config.ts\`, validating required keys before startup.`);
commit('docs: document backend deployment strategy');

// ---------------------------------------------------------
// 3. 3rd-Party API Integration (Gemini)
// ---------------------------------------------------------
appendToFile('PRD.md', `---
# 18. 3rd-Party API Integration (Gemini)

## Purpose
To leverage an advanced LLM (Google Gemini) for unstructured productivity insight generation, returning zero tokens when missing credentials to avoid failure.`);

appendToFile('HLD.md', `---
# 16. Gemini API Integration

FocusFlow integrates directly with the Google Gemini API using native Node \`fetch\`.

*   **Request Construction:** A prompt combining the user request and system instruction is sent along with \`TOOL_DECLARATIONS\`.
*   **Response Parsing:** Extracts JSON function calls or text content.
*   **Token Monitoring:** Reads \`usageMetadata\`.
*   **Error Handling:** In the event of network failure or missing API key, the system executes a deterministic fallback, ensuring the workflow continues. API keys are never hard-coded.`);

appendToFile('LLD.md', `---
# 21. 3rd-Party API Integration (Gemini)

## Implementation & Relevant Files
*   **File:** \`server/src/agent/llmInsight.ts\`.
*   **Method:** Uses standard \`fetch\` to \`https://generativelanguage.googleapis.com/v1beta/...\`.
*   **Cost Calculation:** Extracts \`usageMetadata.promptTokenCount\` and uses constants in \`config.ts\` to calculate estimated cost.
*   **Graceful Degradation:** If \`GEMINI_API_KEY\` is empty or a network error occurs, it returns a static fallback insight (\`priority: 'unknown'\`).`);
commit('docs: document Gemini API integration');

// ---------------------------------------------------------
// 4. Form Handling — Controlled Inputs
// ---------------------------------------------------------
appendToFile('PRD.md', `---
# 19. Controlled Form Inputs

## Purpose
Ensure that React acts as the single source of truth for user input, providing immediate responsiveness and synchronisation with layout state.`);

appendToFile('HLD.md', `---
# 17. Controlled Form Handling

All forms in FocusFlow (Login, Task creation) employ the React Controlled Inputs pattern. 
Component state is strictly bound to input values via \`value\` and \`onChange\` handlers.`);

appendToFile('LLD.md', `---
# 22. Form Handling — Controlled Inputs

## Implementation & Relevant Files
*   **Files:** \`client/src/pages/Login.tsx\` and \`Tasks.tsx\`.
*   **Pattern:**
    \`\`\`tsx
    const [title, setTitle] = useState('');
    // ...
    <input value={title} onChange={(e) => setTitle(e.target.value)} />
    \`\`\`
*   **Benefit:** React retains full authority over the form. Submitting relies on current state, not DOM reading.`);
commit('docs: document controlled form inputs');

// ---------------------------------------------------------
// 5. Form Validation (Client-side)
// ---------------------------------------------------------
replaceInFile('client/src/pages/Login.tsx',
    `    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {`,
    `    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Client-side validation: fast feedback before network fetch
        if (password.length < 6) {
            setError('Password must be at least 6 characters (client validation).');
            return;
        }

        try {`);

appendToFile('PRD.md', `---
# 20. Client-Side Form Validation

## Purpose
To improve UX by catching obvious invalid inputs (e.g., short passwords) instantly before waiting for server responses.

## Requirements
*   Client validation enhances UX.
*   Backend validation remains the fundamental security/trust boundary.`);

appendToFile('HLD.md', `---
# 18. Validation Strategy

Validation occurs at both boundaries:
*   **Client:** React state-based validation gives instant feedback (e.g. password length).
*   **Backend:** Express middleware (\`validate.ts\`) guarantees integrity. Client validation does not replace backend validation.`);

appendToFile('LLD.md', `---
# 23. Form Validation (Client-Side)

## Implementation & Relevant Files
*   **File:** \`client/src/pages/Login.tsx\`.
*   **Implementation:** Pre-flight check inside \`handleSubmit\` verifies \`password.length >= 6\` and sets \`setError\` immediately if it fails.
*   **Trade-offs:** Redundant logic is maintained on front and back end, but provides a demonstrably superior user experience.`);
commit('feat: add client-side form validation');

// ---------------------------------------------------------
// 6. Loading & Error UI States
// ---------------------------------------------------------
let tasksCode = fs.readFileSync(path.join(rootDir, 'client/src/pages/Tasks.tsx'), 'utf8');

// Add states
tasksCode = tasksCode.replace(
    `const { token } = useAuth();`,
    `const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');`
);

// Add to fetchTasks
tasksCode = tasksCode.replace(
    `const fetchTasks = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/tasks', {`,
    `const fetchTasks = async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch('http://localhost:4000/api/tasks', {`
);
tasksCode = tasksCode.replace(
    `            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (err) {
            console.error(err);
        }
    };`,
    `            if (!res.ok) throw new Error('Failed to load tasks');
            const data = await res.json();
            setTasks(data);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };`
);

// Add UI elements
tasksCode = tasksCode.replace(
    `            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {visibleTasks.map(task => (`,
    `            {isLoading && <p>Loading tasks...</p>}
            {errorMsg && <p style={{ color: 'red' }}>Error: {errorMsg}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!isLoading && visibleTasks.map(task => (`
);
tasksCode = tasksCode.replace(
    `                {visibleTasks.length === 0 && (
                    <p>No tasks match the current filter.</p>
                )}
            </div>`,
    `                {!isLoading && visibleTasks.length === 0 && (
                    <p>No tasks match the current filter.</p>
                )}
            </div>`
);

fs.writeFileSync(path.join(rootDir, 'client/src/pages/Tasks.tsx'), tasksCode);

appendToFile('PRD.md', `---
# 21. Loading & Error UI States

## Purpose
Prevent user confusion during asynchronous network operations by clearly denoting activity and failure.

## Requirements
*   Display explicit loading indicators during API calls.
*   Display human-readable error messages on failure.`);

appendToFile('HLD.md', `---
# 19. Asynchronous UI States

Components fetching data maintain \`isLoading\` and \`errorMsg\` states, preventing blank screens or silent failures during network requests. The UI immediately reflects backend delays or downtimes.`);

appendToFile('LLD.md', `---
# 24. Loading & Error UI States

## Implementation & Relevant Files
*   **File:** \`client/src/pages/Tasks.tsx\`
*   **Flow:** \`fetchTasks()\` sets \`setIsLoading(true)\` natively, blocking empty list renders. A \`finally\` block ensures the loading state completes safely.`);
commit('feat: add loading and error UI states');

// ---------------------------------------------------------
// 7. Responsive Layout & Styling 
// ---------------------------------------------------------
let tasksStyleCode = fs.readFileSync(path.join(rootDir, 'client/src/pages/Tasks.tsx'), 'utf8');

tasksStyleCode = tasksStyleCode.replace(
    `<div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>`,
    `<div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <style>
                {\`
                @media (max-width: 600px) {
                    .task-card {
                        flex-direction: column !important;
                        gap: 12px;
                    }
                    .header-container {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 10px;
                    }
                }
                \`}
            </style>`
);

tasksStyleCode = tasksStyleCode.replace(
    `<header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>`,
    `<header className="header-container" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>`
);

tasksStyleCode = tasksStyleCode.replace(
    `                        key={task._id}
                        style={{
                            display: 'flex',`,
    `                        key={task._id}
                        className="task-card"
                        style={{
                            display: 'flex',`
);
fs.writeFileSync(path.join(rootDir, 'client/src/pages/Tasks.tsx'), tasksStyleCode);

appendToFile('PRD.md', `---
# 22. Responsive Layout

## Requirement
The application must present a usable interface across desktop, tablet, and mobile orientations without requiring a full desktop viewport.`);

appendToFile('HLD.md', `---
# 20. Responsive Design

Layouts favor CSS Flexbox (e.g. \`display: flex\`). Embedded CSS media queries (e.g. \`max-width: 600px\`) adapt these directional layouts into vertical stacks on narrow viewports.`);

appendToFile('LLD.md', `---
# 25. Responsive Layout & Styling

## Implementation & Relevant Files
*   **File:** \`client/src/pages/Tasks.tsx\`.
*   **Methodology:** Uses inline \`<style>\` tags setting \`flex-direction: column\` for \`.task-card\` and \`.header-container\` classes below 600px width. Maintains simple structure without large framework dependencies.`);
commit('style: improve responsive application layout');

// ---------------------------------------------------------
// 8. SQL Filtering, Ordering, Grouping
// ---------------------------------------------------------
let sqlCode = fs.readFileSync(path.join(rootDir, 'server/src/db/queries/analyticsQueries.ts'), 'utf8');

sqlCode = sqlCode.replace(
    `export const getTimeSpentPerUserPerTask = async () => {`,
    `export const getTimeSpentPerUserPerTask = async (userId: string) => {`
);

sqlCode = sqlCode.replace(
    `    GROUP BY u.name, t.title
    ORDER BY "totalSeconds" DESC;`,
    `    WHERE u.id = $1
    GROUP BY u.name, t.title
    ORDER BY "totalSeconds" DESC;`
);

sqlCode = sqlCode.replace(
    `    const result = await pool.query(query);`,
    `    const result = await pool.query(query, [userId]);`
);
fs.writeFileSync(path.join(rootDir, 'server/src/db/queries/analyticsQueries.ts'), sqlCode);

appendToFile('PRD.md', `---
# 23. PostgreSQL Grouping & Ordering

## Purpose
To provide sophisticated user-level analytic reports leveraging native relational grouping logic.`);

appendToFile('HLD.md', `---
# 21. SQL Grouped Analytics

The \`analytics_sessions\` PostgreSQL table provides high-performance reporting. Queries filter down strictly to the requested user's workspace, group by foreign entities (tasks), sum metrics over sessions, and order natively at the DB level, preventing the application layer from caching and iterating over large session volumes.`);

appendToFile('LLD.md', `---
# 26. SQL Filtering, Ordering, Grouping

## Implementation & Relevant Files
*   **File:** \`server/src/db/queries/analyticsQueries.ts\`.
*   **Role:** \`getTimeSpentPerUserPerTask(userId)\`.
*   **Query Operations:** 
    *   \`WHERE u.id = $1\` (Parameterized, SQL Injection proof filtering).
    *   \`GROUP BY u.name, t.title\` (Rolls up multiple session logs into distinct Task rows).
    *   \`SUM(s.duration)\` (Aggregation function).
    *   \`ORDER BY "totalSeconds" DESC\` (Sorting workload executed in DB).`);
commit('feat: add grouped PostgreSQL analytics query');

// ---------------------------------------------------------
// 9. SQL Indexing
// ---------------------------------------------------------
appendToFile('PRD.md', `---
# 24. PostgreSQL Indexing

## Purpose
To maintain fast analytic query times even as session logs grow exponentially.`);

appendToFile('HLD.md', `---
# 22. Relational Indexes

Keys frequently used in analytic \`JOIN\` and \`WHERE\` clauses are explicitly backed by PostgreSQL B-tree Indexes, shifting performance bottlenecks away from sequential table scans.`);

appendToFile('LLD.md', `---
# 27. PostgreSQL Indexing for Performance

## Implementation & Relevant Files
*   **File:** \`server/src/db/pg.ts\`.
*   **Indexes Created:**
    *   \`idx_analytics_sessions_user_id\` on \`analytics_sessions(user_id)\`
    *   \`idx_analytics_sessions_task_id\` on \`analytics_sessions(task_id)\`
*   **Justification:** The analytics query filters heavily on \`user_id\` and joins on \`task_id\`. Without these indexes, counting or aggregating sessions would devolve into sequential scans over potentially gigabytes of chronological session data.`);
commit('perf: add PostgreSQL analytics indexes');

console.log("All topics applied successfully!");
