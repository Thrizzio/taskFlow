# TaskFlow — Intelligent Focus & Productivity System

TaskFlow is a production-grade full-stack productivity engineering platform built with React, Node.js, TypeScript, MongoDB, PostgreSQL, Redis, and Socket.IO. It combines task management, timed focus sessions, relational analytics, and LLM-assisted productivity recommendations with advanced systems engineering patterns.

---

## 🌟 Architecture & Complete 15/15 Engineering Rubric

The codebase demonstrates all 15 core and advanced engineering concepts implemented with atomic commits, comprehensive test suites, and strict architectural boundaries:

| # | Concept | Key Implementation Files | Description |
|---|---|---|---|
| 1 | **Input Sanitization & Injection Defense** | `server/src/utils/sanitize.ts`<br>`server/src/middleware/sanitize.ts` | Multi-layer defense stripping NoSQL query operators (`$`, `.`) and escaping HTML entities to prevent XSS and NoSQL injection. |
| 2 | **OAuth / 3rd-Party Login** | `server/src/utils/oauth.ts`<br>`server/src/controllers/authController.ts` | Google OAuth 2.0 Authorization Code flow with state nonce CSRF protection, token exchange, and account unification. |
| 3 | **Role-Based Authorization (RBAC)** | `server/src/middleware/role.ts`<br>`server/src/controllers/adminController.ts` | Stateless JWT role claims (`user`, `admin`), `requireRole` route guards, 401/403 separation, and admin telemetry endpoints. |
| 4 | **File Upload Handling & Security** | `server/src/middleware/upload.ts`<br>`server/src/controllers/taskController.ts` | Multer multipart pipeline, 5MB limit, MIME/extension whitelist, UUID renaming, and strict path traversal validation (`isSafeFilePath`). |
| 5 | **Frontend Container Deployment** | `client/Dockerfile`<br>`client/nginx.conf`<br>`client/src/config/api.ts` | Multi-stage Docker build (`node:22-alpine` → `nginx:alpine`), SPA client routing fallback (`try_files`), and HTTP security headers. |
| 6 | **ORM Layer (Prisma ORM)** | `server/prisma/schema.prisma`<br>`server/src/db/prisma.ts` | Declarative relational modeling, compile-time type safety, automated migrations, and dual-query comparison with raw SQL. |
| 7 | **Database Transactions (ACID)** | `server/src/controllers/sessionController.ts` | Multi-step PostgreSQL persistence (User + Task + Session) inside atomic `prisma.$transaction` with rollback verification. |
| 8 | **Redis In-Memory Caching** | `server/src/utils/redis.ts`<br>`server/src/controllers/analyticsController.ts` | Cache-Aside pattern for read-heavy analytics (`X-Cache: HIT/MISS`), event-driven cache invalidation, and offline fallback. |
| 9 | **Scheduled Jobs / Cron** | `server/src/jobs/cleanupJob.ts`<br>`server/src/jobs/scheduler.ts` | `node-cron` recurring maintenance scanning `/uploads` for orphaned files, 24h grace period safety, and unreferenced cleanup. |
| 10 | **WebSocket Real-Time Sync** | `server/src/socket.ts`<br>`client/src/context/SocketContext.tsx` | Socket.IO with JWT handshake authentication, private user-scoped rooms (`user:${userId}`), and real-time task synchronization. |
| 11 | **Responsive Layout & Styling Competence** | `client/src/pages/Tasks.tsx`<br>`client/src/pages/Analytics.tsx`<br>`client/src/pages/TaskDetail.tsx`<br>`client/src/pages/Focus.tsx` | Multi-viewport mobile adaptation (<600px), fluid typography (`clamp`), table horizontal containment, and responsive grids. |
| 12 | **MongoDB Aggregation Pipelines** | `server/src/controllers/taskController.ts`<br>`server/src/routes/taskRoutes.ts` | Multi-stage `$match` (tenant isolation), `$facet` parallel analytics, `$group`, `$sort`, and `$project` with arithmetic metrics. |
| 13 | **MongoDB Embedding vs Referencing** | `server/src/models/Task.ts`<br>`server/src/controllers/taskController.ts` | Hybrid modeling: embedded subdocuments (`attachments`) for bounded 1:few data vs referenced foreign keys (`userId`, `taskId`) for unbounded 1:N data with dynamic `.populate()`. |
| 14 | **Payment Gateway Integration** | `server/src/controllers/paymentController.ts`<br>`server/src/models/Payment.ts`<br>`client/src/pages/Upgrade.tsx` | Sandbox Razorpay checkout flow, server-side HMAC-SHA256 signature verification (`crypto.timingSafeEqual`), and Pro tier activation. |
| 15 | **Server-Side Rendering (SSR)** | `server/src/ssr/renderTaskSummary.ts`<br>`server/src/routes/ssrRoutes.ts` | Isolated React component server rendering via `ReactDOMServer.renderToString()` at `/ssr-demo` with instant FCP and full SEO headers. |

---

## 🏗️ System Architecture

```text
React Client (Nginx SPA Container :80)
    ↕ HTTP / REST (JWT Auth) + WebSocket (Socket.IO Events)
Node.js + Express API Server (Docker Container :4000)
    ├── Redis (In-Memory Cache-Aside Layer for Analytics)
    ├── MongoDB (Mongoose Operational Store: Users, Tasks, Sessions)
    ├── PostgreSQL (Prisma ORM Analytics Store: Relational Aggregations)
    ├── Google Identity Services (OAuth 2.0 3rd-Party Login)
    ├── Google Gemini API (LLM Productivity Insights)
    ├── Local File Storage (/uploads directory with path traversal protection)
    └── Background Cron Scheduler (node-cron maintenance jobs)
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v20+ (Node v24 supported)
* **npm**: v10+
* **MongoDB**: v6+ (or cloud MongoDB Atlas instance)
* **PostgreSQL**: v15+ (or Supabase / Neon instance)
* **Redis** *(Optional for local dev)*: v6+ (gracefully falls back if offline)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Thrizzio/taskFlow.git
cd taskFlow

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` in both directories:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

**Required Server Environment Variables (`server/.env`):**
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/taskflow
POSTGRES_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow
JWT_SECRET=your-super-secret-jwt-key

# Optional: Google OAuth 2.0
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Optional: Redis Cache (defaults to redis://localhost:6379, falls back if offline)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=300

# Optional: Background Maintenance
CLEANUP_CRON_SCHEDULE="0 * * * *"
ORPHANED_FILE_MAX_AGE_HOURS=24
UPLOAD_DIR=./uploads

# Optional: Payment Gateway (Razorpay Sandbox / Test Mode)
RAZORPAY_KEY_ID=rzp_test_mock_key
RAZORPAY_KEY_SECRET=rzp_test_mock_secret

# Optional: Google Gemini API Key
GEMINI_API_KEY=
```

**Client Environment Variables (`client/.env`):**
```env
VITE_API_URL=http://localhost:4000
```

---

## 💻 Running the Application

### Development Mode
```bash
# Terminal 1: Start backend API server
cd server
npm run dev

# Terminal 2: Start frontend client
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.

### Production Docker Containers
```bash
# Build & run client Nginx container
docker build -t taskflow-client ./client
docker run -p 8080:80 -e VITE_API_URL=http://localhost:4000 taskflow-client

# Build & run server container
docker build -t taskflow-server ./server
docker run -p 4000:4000 --env-file server/.env taskflow-server
```

---

## 🧪 Running Tests

TaskFlow features a complete test suite covering unit logic and integration flows using **Vitest** and **Supertest** (all 108 automated tests run offline without external database/Redis/network dependencies):

```bash
cd server

# Run all unit tests (34 tests across 5 test suites)
npm test

# Run all integration tests (74 tests across 12 test suites)
npm run test:integration

# Run TypeScript compile check
npm run build
```

```bash
cd client

# Run client production build
npm run build

# Run Oxlint
npm run lint
```

---

## 📡 API Reference Overview

### Authentication & OAuth
* `POST /api/auth/register` — Create account with email & password (hashed with bcrypt)
* `POST /api/auth/login` — Authenticate and receive JWT token
* `GET /api/auth/google/url` — Fetch Google OAuth 2.0 consent URL with CSRF state nonce
* `POST /api/auth/google/callback` — Exchange authorization code for user profile and JWT

### Tasks, Attachments & Aggregations
* `GET /api/tasks` — List all user tasks (sorted by date)
* `GET /api/tasks/stats` — **MongoDB Aggregation Pipeline**: Grouped status, priority, and completion metrics
* `POST /api/tasks` — Create task (input sanitized, real-time WebSocket event broadcast)
* `GET /api/tasks/:taskId` — Get single task details (embedded attachments)
* `GET /api/tasks/:taskId?populate=user` — **Referenced Entity Population**: Fetch task with populated User document
* `PATCH /api/tasks/:taskId` — Update task (whitelisted fields only, real-time broadcast)
* `DELETE /api/tasks/:taskId` — Delete task (real-time broadcast)
* `POST /api/tasks/:taskId/attachments` — Upload file attachment (MIME/ext check, UUID filename)
* `GET /api/tasks/:taskId/attachments` — List task attachments
* `GET /api/tasks/:taskId/attachments/:attachmentId/download` — Secure download with path traversal check
* `DELETE /api/tasks/:taskId/attachments/:attachmentId` — Delete attachment from disk and metadata

### Focus Sessions & Analytics
* `POST /api/focus-sessions` — Log completed session (MongoDB save + PostgreSQL Prisma transaction + Redis cache purge + WebSocket broadcast)
* `GET /api/analytics/time-by-task` — Get time spent per task (Prisma ORM query, Redis Cache-Aside, `X-Cache: HIT/MISS` headers)

### Payment Gateway (Sandbox Billing)
* `POST /api/payment/create-order` — Create sandbox payment order for Pro subscription
* `POST /api/payment/verify` — Server-side HMAC-SHA256 signature verification & Pro activation
* `GET /api/payment/status` — Get Pro subscription status and payment history

### Server-Side Rendering (SSR)
* `GET /ssr-demo` — Isolated React component server rendering via `ReactDOMServer.renderToString()` with instant FCP

### Admin Operations (RBAC Protected)
* `GET /api/admin/overview` — Administrative platform telemetry (`requireRole('admin')`)
* `GET /api/admin/users` — List platform users with roles (`requireRole('admin')`)

### Productivity Agent (LLM)
* `POST /api/agent/productivity` — Multi-stage planner, analyzer, and Gemini LLM insight generator

---

## 📚 Technical Specifications

* [Product Requirements Document (PRD)](./PRD.md)
* [High-Level Design (HLD)](./HLD.md)
* [Low-Level Design (LLD)](./LLD.md)

