# TASKS.md — OpenSilk Task Queue System

Overview of the task queue system implemented in OpenSilk.

---

## Architecture

Three-tier system: **Dashboard** (Vite) → **Hub** (Rust/Axum) → **Worker** (Python).

- Postgres is the source of truth for all task state
- Worker is API-only: talks to Hub via HTTP (`httpx` + Bearer token), never touches Postgres directly
- Redis Streams for instant task notification (`XADD` on create, `XREAD` on worker)
- Redis is optional for the worker (`--no-redis` flag falls back to polling)

### Data Flow

```
Dashboard → POST /workspaces/{id}/tasks → Hub (Rust)
         → XADD tasks:pending → Redis Stream
                                          ↓
Worker (Python) ← XREAD → GET /worker/tasks → Hub
                → dispatch to workflow/agent
                → PATCH /worker/tasks/{id} → Hub
```

---

## Two Endpoint Sets

| Scope | Base path | Auth | Who uses it |
|-------|-----------|------|-------------|
| Admin/Frontend | `/workspaces/{id}/tasks` | JWT (user session) | Dashboard, API scripts |
| Internal worker | `/worker/tasks` | `WORKER_TOKEN` bearer | Python worker only |

Worker endpoints are separate from user endpoints. No registration or login needed for the worker.

---

## Task Types

| Type | Description |
|------|-------------|
| `workflow` | A rigid, step-by-step LangGraph pipeline (e.g. `hello_agents`) |
| `agentic` | A dynamic ReAct-loop AI agent (e.g. `openclaw`) |

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
| `pending` | `cancelled` | POST .../cancel | User |
| `running` | `cancelled` | POST .../cancel | User |

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

## Admin Endpoints (JWT auth)

All under `/workspaces/{id}/tasks`. Require authenticated workspace owner.

| Method | Path | Description | Status Code |
|--------|------|-------------|-------------|
| POST | `/{id}/tasks` | Create task | 201 |
| GET | `/{id}/tasks` | List tasks (optional `?status=` filter) | 200 |
| GET | `/{id}/tasks/{task_id}` | Get single task | 200 / 404 |
| PATCH | `/{id}/tasks/{task_id}` | Update task (output_data, error_log) | 200 / 404 |
| POST | `/{id}/tasks/{task_id}/cancel` | Cancel pending or running task | 200 / 404 |

Full API reference: see [docs/API.md](API.md).

---

## Worker Endpoints (`WORKER_TOKEN` bearer auth)

All under `/worker/tasks`. Authenticated by `Authorization: Bearer <token>` matched against the `WORKER_TOKEN` env var on the Hub.

`WORKER_TOKEN` accepts a **comma-separated list** of tokens, allowing rotation without downtime — add a new token to the list, deploy, then remove the old one.

| Method | Path | Description | Status Code |
|--------|------|-------------|-------------|
| GET | `/worker/tasks` | List tasks across all workspaces. Optional `?status=pending`. | 200 |
| PATCH | `/worker/tasks/{task_id}` | Claim, complete, heartbeat, or retry a task. | 200 / 404 |

### PATCH /worker/tasks/{task_id} — Request body

```json
{ "status": "completed", "output_data": { "greeting": "Hello!" } }
```

```json
{ "status": "running" }
```

```json
{ "retry": true, "error_log": "something went wrong" }
```

All fields optional. Uses `COALESCE` so `null` fields don't overwrite.

---

## MCP Tool Registry

Workflows and agents are exposed to the frontend via **MCP-format tool listings**. Instead of hardcoding per-tool UI in the dashboard, the server describes each tool with a JSON Schema `inputSchema` and the frontend dynamically renders the form.

### Endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/workspaces/{id}/tasks/types?type=workflow` | `ListToolsResult` for available workflows |
| GET | `/workspaces/{id}/tasks/types?type=agentic` | `ListToolsResult` for available agentic tools |

Both require JWT auth (workspace owner).

### Server-side (Rust)

Each tool is built with `rmcp::model::Tool` and annotated with `ToolAnnotations`:

```rust
// Input schema struct — schemars derives JSON Schema automatically
#[derive(Deserialize, JsonSchema)]
pub struct HelloAgentsInput {
    #[schemars(description = "Name to greet")]
    pub name: Option<String>,
}

// Handler returns MCP ListToolsResult
pub async fn list_workflows(...) -> Result<Json<ListToolsResult>, AppError> {
    let tool = Tool::new("hello_agents", "Multi-step LangGraph workflow...", serde_json::Map::new())
        .with_input_schema::<HelloAgentsInput>()
        .with_title("Hello Agents")
        .annotate(ToolAnnotations::with_title("Hello Agents").read_only(true).destructive(false));
    Ok(Json(ListToolsResult::with_all_items(vec![tool])))
}
```

Key fields on each `Tool`:
- **`name`** — internal identifier, used as the task `name` when creating a task (e.g. `hello_agents`)
- **`description`** — human-readable summary shown in the UI
- **`inputSchema`** — JSON Schema (`$schema`, `type`, `properties`) auto-generated from the Rust struct via `schemars`
- **`annotations.title`** — display name used in the tool dropdown (falls back to `name`)

### Frontend-side (React)

The `CreateTaskDialog` uses the tool registry to build its form dynamically:

1. On open, fetches tools via `listTaskTypes({type: ...})` server function
2. User selects **type** (workflow/agent) → **tool** from dropdown (shows `annotations.title`)
3. The dialog inspects `tool.inputSchema.properties`:
   - **Simple schemas** (only `string`, `number`, `integer`, `boolean` properties) → renders individual typed inputs with descriptions from the schema
   - **Complex schemas** → falls back to raw JSON textarea
4. On submit, `tool.name` becomes the task `name`, collected inputs become `input_data`

```
┌─────────────────────────────────────────────────┐
│ Create Task                                     │
│                                                 │
│ Type:      [Workflow ▾]                         │
│ Tool:      [Hello Agents ▾]                     │
│            Multi-step LangGraph workflow: ...    │
│                                                 │
│ Parameters:                                     │
│   Name — Name to greet                          │
│   [________________________]                    │
│                                                 │
│                          [Cancel] [Create]      │
└─────────────────────────────────────────────────┘
```

### Adding a new workflow/agent

1. **Python worker:** Add handler to `dispatcher.py` REGISTRY + implement the function
2. **Rust server:** Add a `#[derive(JsonSchema)]` input struct, create a `Tool` in the appropriate `list_*` handler
3. **Frontend:** Nothing to change — the form renders automatically from the schema

---

## Rust Hub Implementation

- **Admin handlers:** `opensilk-server/src/tasks/handlers.rs` — `create`, `list`, `get`, `update`, `cancel` (under `/workspaces/{id}/tasks`, JWT auth)
- **Worker handlers:** `opensilk-server/src/tasks/worker_handlers.rs` — `list_all`, `update_task` (under `/worker/tasks`, `WORKER_TOKEN` auth)
- **Worker middleware:** Validates `Authorization: Bearer <token>` against the `WORKER_TOKEN` env var (comma-separated). Returns 401 on mismatch.
- **Route wiring:** Admin routes in `workspaces/mod.rs` with JWT `route_layer`. Worker routes in `main.rs` with worker auth `route_layer`.
- **Redis:** Uses `fred` crate. `XADD` publishes to `tasks:pending` stream on task creation.
- **SQL aliasing:** `type` is a Rust keyword, so all queries use `type AS "task_type"`

---

## Python Worker Implementation

```
opensilk-agents/
├── main.py              # CLI entry point (argparse)
├── api.py               # HubClient — async HTTP client (httpx + WORKER_TOKEN)
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
opensilk-workers [--worker-id worker-1] [--verbose] [--no-redis]
```

No workspace ID or user token needed. Worker polls all pending tasks across all workspaces.

### Env Vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUB_URL` | no | `http://localhost:8080` | Base URL of Rust hub |
| `WORKER_TOKEN` | yes | — | Shared secret(s), comma-separated for rotation |
| `REDIS_URL` | no | `redis://localhost:6379/0` | Redis connection URL |

### Dispatcher Registry

```python
REGISTRY = {
    "workflow": { "hello_agents": run_hello_agents },
    "agentic":  { "openclaw": run_openclaw },
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
    type TEXT NOT NULL CHECK (type IN ('workflow', 'agentic')),
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

A background recovery worker (`src/workers/recovery.rs`) automatically recovers tasks stuck in `running` with no heartbeat for 2 minutes. It runs on a configurable interval (env `RECOVERY_INTERVAL_SECS`, default 60 seconds).

**Recover to `pending`** (retries left):
```sql
UPDATE tasks
SET status = 'pending',
    error_log = 'Recovered: worker heartbeat timeout',
    retry_count = retry_count + 1,
    updated_at = NOW()
WHERE status = 'running'
  AND last_heartbeat_at < NOW() - INTERVAL '2 minutes'
  AND retry_count < max_retries
RETURNING id, workspace_id, type AS "task_type", name
```

Each recovered task is published to Redis Stream `tasks:pending` via `XADD` so opensilk-agents picks it up instantly.

**Fail permanently** (retries exhausted):
```sql
UPDATE tasks
SET status = 'failed',
    error_log = 'Recovered: worker heartbeat timeout, max retries exhausted',
    updated_at = NOW()
WHERE status = 'running'
  AND last_heartbeat_at < NOW() - INTERVAL '2 minutes'
  AND retry_count >= max_retries
```

These tasks are terminal — no Redis notification needed.
