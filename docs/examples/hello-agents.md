# hello_agents — End-to-End Walkthrough

Trace a task from creation to completion through every HTTP call, internal process, and data flow.

**Prerequisites:** opensilk-server + opensilk-agents + Redis running (`docker compose up -d`).

---

## 1. Register

```
POST /auth/register
Content-Type: application/json

{"email":"alice@example.com","password":"password123","full_name":"Alice"}
```

Response `201`:
```json
{
  "id": "019d8afa-c504-70f5-b2b6-d35731fbb3e3",
  "email": "alice@example.com",
  "full_name": "Alice",
  "created_at": "2026-04-14T07:53:03.491978Z"
}
```

**opensilk-server:** Hashes password with argon2, inserts into `users` table. `password_hash` is never returned.

---

## 2. Login

```
POST /auth/login
Content-Type: application/json

{"email":"alice@example.com","password":"password123"}
```

Response `200` with headers:
```
Set-Cookie: access_token=eyJ0eXAi...; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
```
```json
{
  "id": "019d8afa-c504-70f5-b2b6-d35731fbb3e3",
  "email": "alice@example.com",
  "full_name": "Alice",
  "created_at": "2026-04-14T07:53:03.491978Z"
}
```

**opensilk-server:** Verifies password with argon2, generates JWT with `sub=user_id, exp=24h`, builds HttpOnly cookie. Token can also be sent as `Authorization: Bearer <jwt>` — cookie is for browsers, Bearer is for API scripts.

---

## 3. Create Workspace

```
POST /workspaces
Content-Type: application/json
Authorization: Bearer <jwt>

{"name":"Demo Workspace"}
```

Response `201`:
```json
{
  "id": "019d8afb-9483-74c8-ad84-1f5d303b3050",
  "name": "Demo Workspace",
  "owner_id": "019d8afa-c504-70f5-b2b6-d35731fbb3e3",
  "created_at": "2026-04-14T07:53:56.611193Z",
  "updated_at": "2026-04-14T07:53:56.611193Z"
}
```

**opensilk-server:** Auth middleware extracts `user_id` from JWT, injects `AuthUser` into request. Handler inserts workspace with `owner_id = user_id`.

---

## 4. Create Task

```
POST /workspaces/019d8afb-9483-74c8-ad84-1f5d303b3050/tasks
Content-Type: application/json
Authorization: Bearer <jwt>

{"type":"workflow","name":"hello_agents","input_data":{"name":"Alice"}}
```

Response `201`:
```json
{
  "id": "019d8afb-e9b9-778f-9951-1deebf1e6fea",
  "workspace_id": "019d8afb-9483-74c8-ad84-1f5d303b3050",
  "type": "workflow",
  "name": "hello_agents",
  "status": "pending",
  "retry_count": 0,
  "max_retries": 3,
  "last_heartbeat_at": "2026-04-14T07:54:18.425358Z",
  "input_data": {"name": "Alice"},
  "output_data": null,
  "error_log": null,
  "created_at": "2026-04-14T07:54:18.425358Z",
  "updated_at": "2026-04-14T07:54:18.425358Z"
}
```

**opensilk-server (two things happen):**

1. **INSERT into `tasks` table** — `status='pending'`, `retry_count=0`, `max_retries=3`, `last_heartbeat_at=NOW()`.
2. **XADD to Redis Stream `tasks:pending`** — publishes `{"task_id":"...","workspace_id":"...","type":"workflow","name":"hello_agents"}`. This is the notification that wakes up opensilk-agents.

---

## 5. opensilk-agents Picks Up the Task

opensilk-agents is already running, blocked on `XREAD tasks:pending` with a 5-second timeout.

**What happens inside opensilk-agents:**

```
[XREAD receives message from tasks:pending stream]
→ extracts task_id from stream message
→ calls HubClient.claim_task(task_id)
  → PATCH /worker/tasks/{task_id} {"status":"running"}   (atomic claim: only succeeds if status='pending')
  → if 404 (already claimed by another agent), skip and wait for next
→ starts Heartbeat (30s interval)
→ dispatches to hello_agents workflow
```

**HTTP calls opensilk-agents makes to opensilk-server:**

```
GET /worker/tasks?status=pending
Authorization: Bearer <WORKER_TOKEN>
```
Response `200`:
```json
[
  {
    "id": "019d8afb-e9b9-778f-9951-1deebf1e6fea",
    "status": "pending",
    "type": "workflow",
    "name": "hello_agents",
    ...
  }
]
```

```
PATCH /worker/tasks/019d8afb-e9b9-778f-9951-1deebf1e6fea
Authorization: Bearer <WORKER_TOKEN>
Content-Type: application/json

{"status":"running"}
```
Response `200` — task is now `running`, `last_heartbeat_at` updated to `NOW()`.

**opensilk-server:** Worker auth middleware checks `Authorization: Bearer <token>` against `WORKER_TOKEN` env var (comma-separated list). No JWT or user account needed.

---

## 6. Workflow Execution (LangGraph)

The dispatcher routes `type=workflow, name=hello_agents` to the LangGraph handler.

```
START → greet → assess_mood → [cheerful|curious|philosophical] → END
```

**Step by step inside the graph:**

| Step | Node | What it does | State change |
|------|------|-------------|--------------|
| 1 | `greet` | Builds greeting string | `greeting = "Hello, Alice!"` |
| 2 | `assess_mood` | Randomly picks a mood | `mood = "cheerful"` |
| 3 | `route_by_mood` | Conditional edge function | Returns `"cheerful"` |
| 4 | `respond_cheerful` | Builds final response | `response = "Hello, Alice! Great to have you here..."` |

The graph returns the full state. The handler extracts and returns:
```python
{"greeting": "Hello, Alice!", "mood": "cheerful", "response": "Hello, Alice! Great to have you here. The agents are fired up and ready!"}
```

The mood is random — each run may produce `cheerful`, `curious`, or `philosophical`.

---

## 7. opensilk-agents Completes the Task

```
PATCH /worker/tasks/019d8afb-e9b9-778f-9951-1deebf1e6fea
Authorization: Bearer <WORKER_TOKEN>
Content-Type: application/json

{"status":"completed","output_data":{"greeting":"Hello, Alice!","mood":"cheerful","response":"Hello, Alice! Great to have you here. The agents are fired up and ready!"}}
```

Response `200`.

**opensilk-server:** Updates `tasks` row — `status='completed'`, `output_data=<json>`, `updated_at=NOW()`.

opensilk-agents then stops the heartbeat and goes back to polling.

---

## 8. Fetch Completed Task

```
GET /workspaces/019d8afb-9483-74c8-ad84-1f5d303b3050/tasks/019d8afb-e9b9-778f-9951-1deebf1e6fea
Authorization: Bearer <jwt>
```

Response `200`:
```json
{
  "id": "019d8afb-e9b9-778f-9951-1deebf1e6fea",
  "status": "completed",
  "input_data": {"name": "Alice"},
  "output_data": {
    "greeting": "Hello, Alice!",
    "mood": "cheerful",
    "response": "Hello, Alice! Great to have you here. The agents are fired up and ready!"
  },
  "retry_count": 0,
  "max_retries": 3
}
```

---

## Full Timeline

```
T+0ms    POST /auth/register                          → 201 (user created)
T+50ms   POST /auth/login                             → 200 (JWT issued, cookie set)
T+100ms  POST /workspaces                             → 201 (workspace created)
T+150ms  POST /workspaces/{id}/tasks                  → 201 (task inserted)
         opensilk-server: XADD tasks:pending → Redis
T+151ms  opensilk-agents: XREAD wakes up, receives stream event
T+152ms  opensilk-agents: GET  /worker/tasks?status=pending    → 200 (lists pending tasks)
T+153ms  opensilk-agents: PATCH /worker/tasks/{id}             → 200 (status=running)
         opensilk-agents: Heartbeat started (30s interval)
         opensilk-agents: LangGraph executes START→greet→assess_mood→respond_cheerful→END
T+160ms  opensilk-agents: PATCH /worker/tasks/{id}             → 200 (status=completed + output_data)
         opensilk-agents: Heartbeat stopped
T+5s     opensilk-agents: back to XREAD, waiting for next task
```

---

## Error Flow (What Happens on Failure)

If the workflow throws an exception, instead of calling `complete_task`, opensilk-agents calls:

```
PATCH /worker/tasks/{id}
Authorization: Bearer <WORKER_TOKEN>
Content-Type: application/json

{"retry":true,"error_log":"something went wrong"}
```

**opensilk-server decides the outcome:**

- `retry_count + 1 < max_retries` → sets `status='pending'`, increments `retry_count`
- `retry_count + 1 >= max_retries` → sets `status='failed'`, increments `retry_count`

opensilk-agents never decides retry vs failed — opensilk-server does.

---

## Two Auth Systems Side by Side

| | Admin (user) | opensilk-agents (internal) |
|---|---|---|
| **Auth** | JWT (Bearer header or cookie) | `WORKER_TOKEN` (Bearer header) |
| **How to get token** | `POST /auth/login` | Set in `.env` |
| **Endpoints** | `/workspaces/{id}/tasks/*` | `/worker/tasks/*` |
| **Scope** | Single workspace | All workspaces |
| **Who** | Dashboard, API scripts | opensilk-agents only |
