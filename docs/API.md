# opensilk-server API Reference

Base URL: `http://localhost:8080`

## Authentication

All authenticated endpoints accept a valid JWT via **either** method (Authorization header takes priority when both are present):

**Option 1 — Bearer token** (for API/mobile clients):
```
Authorization: Bearer <jwt>
```

**Option 2 — HttpOnly cookie** (for browser clients):
```
Cookie: access_token=<jwt>
```

The cookie is set automatically on successful login.

| Property | Value |
|---|---|
| Cookie name | `access_token` |
| Flags | `HttpOnly`, `SameSite=Lax`, `Path=/` |
| Max-Age | 86400 (24 hours) |

Browser clients can rely on cookies being sent automatically. Non-browser clients (API scripts, mobile apps) should use the `Authorization: Bearer <token>` header instead.

## Error Format

All errors return a JSON body:

```json
{
  "error": <status_code>,
  "message": "<description>"
}
```

| Status | Meaning |
|---|---|
| 401 | Authentication failed or missing |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Internal server error |

---

## Endpoints

### GET /health

Database health check. No authentication required.

**Response:** `200 OK` (empty body)

---

### POST /auth/register

Create a new user account.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "full_name": "John Doe"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Non-empty, must be unique |
| `password` | string | yes | Minimum 8 characters |
| `full_name` | string | no | Display name |

**Response:** `201 Created`
```json
{
  "id": "019d8a61-86fa-7875-a4db-b6ad3435a49c",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2026-04-14T05:00:00Z"
}
```

**Error responses:**
- `401` — Email empty or password too short
- `409` — Email already registered

---

### POST /auth/login

Authenticate and receive a session cookie.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response:** `200 OK`
```json
{
  "id": "019d8a61-86fa-7875-a4db-b6ad3435a49c",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2026-04-14T05:00:00Z"
}
```

**Headers:**
```
Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
```

**Error responses:**
- `401` — Invalid email or password

---

### POST /auth/logout

Clear the session cookie. No authentication required.

**Response:** `200 OK`
```json
{
  "message": "logged out"
}
```

**Headers:**
```
Set-Cookie: access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
```

---

### POST /workspaces

Create a new workspace. **Requires authentication.**

**Request body:**
```json
{
  "name": "My Workspace"
}
```

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |

**Response:** `201 Created`
```json
{
  "id": "019d8a6b-5b9d-765c-9321-3a0729c550a2",
  "name": "My Workspace",
  "owner_id": "019d8a61-86fa-7875-a4db-b6ad3435a49c",
  "created_at": "2026-04-14T05:01:00Z",
  "updated_at": "2026-04-14T05:01:00Z"
}
```

**Error responses:**
- `401` — Not authenticated

---

### GET /workspaces

List all workspaces owned by the authenticated user. **Requires authentication.**

**Response:** `200 OK`
```json
[
  {
    "id": "019d8a6b-5b9d-765c-9321-3a0729c550a2",
    "name": "My Workspace",
    "owner_id": "019d8a61-86fa-7875-a4db-b6ad3435a49c",
    "created_at": "2026-04-14T05:01:00Z",
    "updated_at": "2026-04-14T05:01:00Z"
  }
]
```

Returns an empty array `[]` if the user has no workspaces.

**Error responses:**
- `401` — Not authenticated

---

### GET /workspaces/{id}

Get a single workspace by ID. Only returns the workspace if it is owned by the authenticated user. **Requires authentication.**

**Path parameters:**

| Parameter | Type |
|---|---|
| `id` | UUID |

**Response:** `200 OK`
```json
{
  "id": "019d8a6b-5b9d-765c-9321-3a0729c550a2",
  "name": "My Workspace",
  "owner_id": "019d8a61-86fa-7875-a4db-b6ad3435a49c",
  "created_at": "2026-04-14T05:01:00Z",
  "updated_at": "2026-04-14T05:01:00Z"
}
```

**Error responses:**
- `401` — Not authenticated
- `404` — Workspace not found or not owned by user

---

## Tasks

Tasks represent units of work dispatched to Python agents. Each task belongs to a workspace and has a `type` (`workflow` or `agent`).

### Task Status Flow

```
pending ──→ running ──→ completed
                │
                ├──→ failed (max retries exhausted)
                └──→ cancelled (user request)
                │
                └──→ pending (retry, if retry_count < max_retries)
```

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `pending` | Waiting to be picked up | Created automatically, or reset by retry |
| `running` | Worker is executing | Worker claims via PATCH `{status: "running"}` |
| `completed` | Finished successfully | Worker PATCHes `{status: "completed", output_data: {...}}` |
| `failed` | Max retries exhausted or fatal error | Rust handler (when `retry_count >= max_retries`) |
| `cancelled` | Cancelled by user | Only from `pending` or `running` via cancel endpoint |

### Retry Behavior

- Default `max_retries` is 3
- Worker calls `PATCH` with `{retry: true, error_log: "..."}` on failure
- Rust handler checks `retry_count + 1 < max_retries`: if true, resets to `pending` and increments `retry_count`; if false, sets to `failed`
- Heartbeat timeout (2 min without update) marks orphaned `running` tasks as `failed`

### Task Types

| Type | Description |
|------|-------------|
| `workflow` | A rigid, step-by-step LangGraph pipeline (e.g. `hello_agents`) |
| `agent` | An autonomous AI agent (e.g. `openclaw`) |

---

### POST /workspaces/{id}/tasks

Create a new task. **Requires authentication** (workspace owner).

**Request body:**
```json
{
  "type": "workflow",
  "name": "hello_agents",
  "input_data": { "name": "Alice" }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | yes | Must be `workflow` or `agent` |
| `name` | string | yes | Handler name (e.g. `hello_agents`, `openclaw`) |
| `input_data` | object | no | Arbitrary JSON passed to the handler |

**Response:** `201 Created`
```json
{
  "id": "019d8b00-0000-7000-8000-000000000001",
  "workspace_id": "019d8a6b-5b9d-765c-9321-3a0729c550a2",
  "type": "workflow",
  "name": "hello_agents",
  "status": "pending",
  "retry_count": 0,
  "max_retries": 3,
  "last_heartbeat_at": "2026-04-14T06:00:00Z",
  "input_data": { "name": "Alice" },
  "output_data": null,
  "error_log": null,
  "created_at": "2026-04-14T06:00:00Z",
  "updated_at": "2026-04-14T06:00:00Z"
}
```

Also publishes to Redis Stream `tasks:pending` for instant worker notification.

**Error responses:**
- `401` — Not authenticated, workspace not found, or invalid `type`
- `404` — Workspace not found

---

### GET /workspaces/{id}/tasks

List tasks for a workspace. **Requires authentication** (workspace owner).

**Query parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | Filter by status: `pending`, `running`, `completed`, `failed`, `cancelled` |

**Response:** `200 OK` — array of task objects (same shape as create response)

Returns an empty array if no tasks match.

**Error responses:**
- `401` — Not authenticated
- `404` — Workspace not found

---

### GET /workspaces/{id}/tasks/{task_id}

Get a single task by ID. **Requires authentication** (workspace owner).

**Path parameters:**

| Parameter | Type |
|---|---|
| `id` | UUID (workspace) |
| `task_id` | UUID (task) |

**Response:** `200 OK` — task object

**Error responses:**
- `401` — Not authenticated
- `404` — Workspace not found or task not found

---

### PATCH /workspaces/{id}/tasks/{task_id}

Update a task. Used by the web dashboard and by workers.

**Path parameters:**

| Parameter | Type |
|---|---|
| `id` | UUID (workspace) |
| `task_id` | UUID (task) |

**Request body** (all fields optional):
```json
{
  "status": "completed",
  "output_data": { "greeting": "Hello!" },
  "error_log": null,
  "retry": false
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | string | New status. Auto-updates `last_heartbeat_at` on change. |
| `output_data` | object | Result data (set on completion). |
| `error_log` | string | Error message. |
| `retry` | boolean | When `true`, increments `retry_count` and resets to `pending` (or `failed` if max retries exhausted). Only valid from `running` status. |

**Worker usage:**
- Heartbeat: `PATCH {status: "running"}` — updates `last_heartbeat_at`
- Complete: `PATCH {status: "completed", output_data: {...}}`
- Fail/retry: `PATCH {retry: true, error_log: "..."}` — server decides pending vs failed

**Response:** `200 OK` — updated task object

**Error responses:**
- `401` — Not authenticated
- `404` — Workspace or task not found

---

### POST /workspaces/{id}/tasks/{task_id}/cancel

Cancel a pending or running task. **Requires authentication** (workspace owner).

No request body.

**Response:** `200 OK` — task object with `status: "cancelled"`

**Error responses:**
- `401` — Not authenticated
- `404` — Task not found or not cancellable (already completed/failed/cancelled)

---

## Worker Endpoints

Internal endpoints for the Python worker. Authenticated by `WORKER_TOKEN` bearer — no user registration or login required.

**Authentication:**
```
Authorization: Bearer <WORKER_TOKEN>
```

The token must match one of the values in the `WORKER_TOKEN` environment variable on the Hub. `WORKER_TOKEN` accepts a **comma-separated list** of tokens for rotation — add a new token, deploy, then remove the old one. These endpoints are not scoped to a workspace — the worker operates across all workspaces.

---

### GET /worker/tasks

List tasks across all workspaces. **Requires `WORKER_TOKEN` bearer auth.**

**Query parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | Filter by status: `pending`, `running`, `completed`, `failed`, `cancelled` |

**Response:** `200 OK` — array of task objects (same shape as create response)

Returns an empty array if no tasks match.

**Error responses:**
- `401` — Invalid or missing `WORKER_TOKEN`

---

### PATCH /worker/tasks/{task_id}

Update a task (claim, complete, heartbeat, or retry). Used exclusively by the worker. **Requires `WORKER_TOKEN` bearer auth.**

**Path parameters:**

| Parameter | Type |
|---|---|
| `task_id` | UUID |

**Request body** (all fields optional):
```json
{
  "status": "completed",
  "output_data": { "greeting": "Hello!" },
  "error_log": null,
  "retry": false
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | string | New status. Auto-updates `last_heartbeat_at` on change. |
| `output_data` | object | Result data (set on completion). |
| `error_log` | string | Error message. |
| `retry` | boolean | When `true`, increments `retry_count` and resets to `pending` (or `failed` if max retries exhausted). |

**Response:** `200 OK` — updated task object

**Error responses:**
- `401` — Invalid or missing `WORKER_TOKEN`
- `404` — Task not found
