# TASKS.md — OpenSilk Task Queue System

Overview of the task queue system implemented in OpenSilk.

---

## Architecture

Three-tier system: **Dashboard** (Vite) → **Hub** (Rust/Axum) → **Worker** (Python).

- Postgres is the source of truth for all task state
- Worker is API-only: talks to Hub via HTTP (`httpx` + Bearer JWT), never touches Postgres directly
- Redis Streams for instant task notification (`XADD` on create, `XREAD` on worker)
- Redis is optional for the worker (`--no-redis` flag falls back to polling)

### Data Flow

```
Dashboard → POST /workspaces/{id}/tasks → Hub (Rust)
         → XADD tasks:pending → Redis Stream
                                          ↓
Worker (Python) ← XREAD → PATCH claim_task → Hub
                → dispatch to workflow/agent
                → PATCH complete_task → Hub
```

---

## Task Types

| Type | Description |
|------|-------------|
| `workflow` | A rigid, step-by-step LangGraph pipeline (e.g. `hello_agents`) |
| `agent` | An autonomous AI agent (e.g. `openclaw`) |

---

## Task Status Flow

```
                  ┌────────── retry ──────────┐
                  ▼                          │
pending ──→ running ──→ completed
                │
                ├──→ failed (max retries exhausted)
                └──→ cancelled (user request)
```

| From | To | Trigger | Who sets it |
|------|-----|----------|-------------|
| (create) | `pending` | Auto (INSERT default) | System |
| `pending` | `running` | `PATCH {status: "running"}` | Worker claims task |
| `running` | `completed` | `PATCH {status: "completed", output_data}` | Worker on success |
| `running` | `pending` | `PATCH {retry: true}` | Worker on failure (if retries left) |
| `running` | `failed` | `PATCH {retry: true}` | Rust handler (retries exhausted) |
| `pending` | `cancelled` | `POST .../cancel` | User |
| `running` | `cancelled` | `POST .../cancel` | User |

**Terminal states:** `completed`, `failed`, `cancelled` — no further transitions.

---

## Retry Behavior

- `max_retries` defaults to 3 (set at creation, stored in DB)
- Worker calls `PATCH {retry: true, error_log: "..."}`
- Rust handler checks `retry_count + 1 < max_retries`:
  - **Yes** → set `status = 'pending'`, increment `retry_count`, store `error_log`
  - **No** → set `status = 'failed'`, increment `retry_count`, store `error_log`

---

## Heartbeat

- Worker sends a heartbeat every 30 seconds via `PATCH {status: "running"}`
- Rust handler auto-updates `last_heartbeat_at = NOW()` on every PATCH that changes status
- Tasks stuck in `running` with no heartbeat for 2 minutes should be cleaned up (orphan cleanup)

---

## Endpoints

All task endpoints are under `/workspaces/{id}/tasks` and require authentication (workspace owner).

| Method | Path | Description | Status Code |
|--------|------|-------------|-------------|
| POST | `/{id}/tasks` | Create task | 201 |
| GET | `/{id}/tasks` | List tasks (optional `?status=` filter) | 200 |
| GET | `/{id}/tasks/{task_id}` | Get single task | 200 / 404 |
| PATCH | `/{id}/tasks/{task_id}` | Update task (status, output_data, error_log, retry) | 200 / 404 |
| POST | `/{id}/tasks/{task_id}/cancel` | Cancel pending or running task | 200 / 404 |

Full API reference with request/response schemas: see [docs/API.md](API.md).

---

## Rust Hub Implementation

- **Handlers:** `opensilk-server/src/tasks/handlers.rs` — 5 handlers: `create`, `list`, `get`, `update`, `cancel`
- **Route wiring:** Routes added directly in `opensilk-server/src/workspaces/mod.rs` before the `route_layer`, inheriting auth middleware
- **Redis:** Uses `fred` crate. `AppState` holds a `RedisClient` (aliased from `fred::prelude::Client`). `XADD` publishes to `tasks:pending` stream on task creation.
- **SQL aliasing:** `type` is a Rust keyword, so all queries use `type AS "task_type"`

---

## Python Worker Implementation

```
opensilk-agents/
├── main.py              # CLI entry point (argparse)
├── api.py               # HubClient — async HTTP client (httpx + Bearer JWT)
├── worker.py            # Poll loop + Redis Stream listener
├── dispatcher.py        # Routes task type + name to handler
├── heartbeat.py         # 30s background heartbeat
├── agents/              # Autonomous agents
│   └── openclaw.py      # Placeholder agent
├── workflows/           # Rigid LangGraph paths
│   └── hello_agents.py  # Greeting workflow (START → greet → END)
├── pyproject.toml
└── uv.lock
```

### CLI

```
opensilk-workers --workspace-id <uuid> [--worker-id worker-1] [--verbose] [--no-redis]
```

### Env Vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUB_URL` | no | `http://localhost:8080` | Base URL of Rust hub |
| `WORKER_TOKEN` | yes | — | JWT Bearer token (from `POST /auth/login`) |
| `REDIS_URL` | no | `redis://localhost:6379/0` | Redis connection URL |

### Dispatcher Registry

```python
REGISTRY = {
    "workflow": { "hello_agents": run_hello_agents },
    "agent":    { "openclaw": run_openclaw },
}
```

All handler functions: `async def handler(input_data: dict) -> dict`

---

## Database Schema

Migration: `opensilk-server/migrations/003_tasks.sql`

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('workflow', 'agent')),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    input_data JSONB,
    output_data JSONB,
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_status_heartbeat ON tasks(status, last_heartbeat_at);
```

---

## Orphan Cleanup

Tasks stuck in `running` with no heartbeat for 2 minutes should be marked as failed:

```sql
UPDATE tasks
SET status = 'failed',
    error_log = 'Worker heartbeat timeout: task orphaned',
    updated_at = NOW()
WHERE status = 'running'
  AND last_heartbeat_at < NOW() - INTERVAL '2 minutes';
```

Run manually or via future scheduled job. Not an endpoint.
