# TaskFlow Client — Frontend Application

Production React Single-Page Application (SPA) built with Vite, TypeScript, React Router, and Socket.IO Client.

---

## 🌟 Key Features

* **Real-Time Task Synchronization:** Powered by `SocketContext` and `socket.io-client`. Automatically updates task status, additions, and deletions without requiring HTTP polling.
* **Controlled Forms & UX Validation:** Real-time client-side feedback for task creation, authentication, and file attachment handling.
* **Responsive Layout:** Adaptive Flexbox layout styling tested across desktop and mobile screens (`max-width: 600px`).
* **Interactive Demonstrations:** Dedicated `/javascript-concepts` educational suite exploring Closures, the Event Loop, Hoisting, and Promises vs Callbacks.
* **Production Nginx Container:** Multi-stage `Dockerfile` producing a lean, hardened static distribution container with SPA route fallback and security headers.

---

## 🚀 Environment Configuration

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base HTTP & WebSocket URL for the Express backend API | `http://localhost:4000` |

---

## 💻 Available Scripts

* `npm run dev`: Starts the local development server with Hot Module Replacement (HMR) at `http://localhost:5173`.
* `npm run build`: Type-checks (`tsc -b`) and bundles production assets into `dist/` with Vite.
* `npm run lint`: Runs `oxlint` static code analysis.
* `npm run preview`: Locally previews the compiled production build.

---

## 🐳 Docker Deployment

The client includes a multi-stage Docker build:

```bash
# Build production image
docker build -t taskflow-client .

# Run container on port 8080
docker run -d -p 8080:80 -e VITE_API_URL=http://localhost:4000 taskflow-client
```

### Nginx SPA Configuration (`nginx.conf`)
* **SPA Fallback:** `try_files $uri $uri/ /index.html` resolves client-side deep links (e.g. `/tasks`, `/analytics`).
* **Security Headers:** Enforces `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `X-XSS-Protection: 1; mode=block`.
