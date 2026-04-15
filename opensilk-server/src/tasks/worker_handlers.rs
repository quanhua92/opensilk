use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;
use crate::tasks::handlers::{ListTasksQuery, TaskResponse, UpdateTaskRequest};

/// List all tasks across all workspaces. No workspace scoping.
pub async fn list_all(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListTasksQuery>,
) -> Result<Json<Vec<TaskResponse>>, AppError> {
    let rows = match params.status {
        Some(ref status) => {
            sqlx::query_as!(
                TaskResponse,
                r#"SELECT id, workspace_id, type AS "task_type", name, status,
                          retry_count, max_retries, last_heartbeat_at,
                          input_data, output_data, error_log, created_at, updated_at
                   FROM tasks
                   WHERE status = $1
                   ORDER BY created_at DESC
                   LIMIT 100"#,
                status,
            )
            .fetch_all(&state.pool)
            .await?
        }
        None => {
            sqlx::query_as!(
                TaskResponse,
                r#"SELECT id, workspace_id, type AS "task_type", name, status,
                          retry_count, max_retries, last_heartbeat_at,
                          input_data, output_data, error_log, created_at, updated_at
                   FROM tasks
                   ORDER BY created_at DESC
                   LIMIT 100"#,
            )
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(rows))
}

/// Update a task by ID only (no workspace scoping).
/// Handles claim, complete, heartbeat, and retry.
pub async fn update_task(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<Uuid>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, AppError> {
    // Retry logic
    if req.retry == Some(true) {
        let row = sqlx::query!(
            r#"SELECT retry_count, max_retries
               FROM tasks WHERE id = $1"#,
            task_id,
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound("Task not found".into()))?;

        if row.retry_count + 1 >= row.max_retries {
            let row = sqlx::query_as!(
                TaskResponse,
                r#"UPDATE tasks
                   SET status = 'failed',
                       retry_count = retry_count + 1,
                       error_log = COALESCE($2, error_log),
                       last_heartbeat_at = NOW(),
                       updated_at = NOW()
                   WHERE id = $1
                   RETURNING id, workspace_id, type AS "task_type", name, status,
                             retry_count, max_retries, last_heartbeat_at,
                             input_data, output_data, error_log, created_at, updated_at"#,
                task_id,
                req.error_log,
            )
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::NotFound("Task not found".into()))?;

            return Ok(Json(row));
        } else {
            let row = sqlx::query_as!(
                TaskResponse,
                r#"UPDATE tasks
                   SET status = 'pending',
                       retry_count = retry_count + 1,
                       error_log = COALESCE($2, error_log),
                       last_heartbeat_at = NOW(),
                       updated_at = NOW()
                   WHERE id = $1
                   RETURNING id, workspace_id, type AS "task_type", name, status,
                             retry_count, max_retries, last_heartbeat_at,
                             input_data, output_data, error_log, created_at, updated_at"#,
                task_id,
                req.error_log,
            )
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::NotFound("Task not found".into()))?;

            return Ok(Json(row));
        }
    }

    // Claim: pending→running is atomic to prevent double-claim by multiple agents
    if req.status.as_deref() == Some("running") {
        let row = sqlx::query_as!(
            TaskResponse,
            r#"UPDATE tasks
               SET status = 'running',
                   last_heartbeat_at = NOW(),
                   updated_at = NOW()
               WHERE id = $1 AND status = 'pending'
               RETURNING id, workspace_id, type AS "task_type", name, status,
                         retry_count, max_retries, last_heartbeat_at,
                         input_data, output_data, error_log, created_at, updated_at"#,
            task_id,
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound("Task not found or already claimed".into()))?;

        return Ok(Json(row));
    }

    // Other updates: complete, heartbeat, etc.
    let row = sqlx::query_as!(
        TaskResponse,
        r#"UPDATE tasks
           SET status = COALESCE($2, status),
               output_data = COALESCE($3, output_data),
               error_log = COALESCE($4, error_log),
               last_heartbeat_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE last_heartbeat_at END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, workspace_id, type AS "task_type", name, status,
                     retry_count, max_retries, last_heartbeat_at,
                     input_data, output_data, error_log, created_at, updated_at"#,
        task_id,
        req.status,
        req.output_data,
        req.error_log,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Task not found".into()))?;

    Ok(Json(row))
}

// --- Task context endpoint for agents ---

#[derive(Serialize)]
pub struct TaskContextResponse {
    pub token: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub agent_id: Uuid,
    pub agent_name: String,
    pub agent_persona: String,
    pub workspace_id: Uuid,
    pub board_id: Uuid,
    pub card_id: Uuid,
    pub card_title: String,
}

/// GET /worker/tasks/{task_id}/context
///
/// Returns an agent-scoped JWT and metadata needed for the worker
/// to act as the agent on the linked card/board.
///
/// Returns 404 if the task has no agent_id or card_id.
pub async fn get_task_context(
    State(state): State<Arc<AppState>>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<TaskContextResponse>, AppError> {
    // 1. Fetch task, ensure agent_id and card_id are set
    let task = sqlx::query!(
        r#"SELECT agent_id, card_id, workspace_id FROM tasks WHERE id = $1"#,
        task_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Task not found".into()))?;

    let agent_id = task
        .agent_id
        .ok_or(AppError::NotFound("Task has no agent assigned".into()))?;
    let card_id = task
        .card_id
        .ok_or(AppError::NotFound("Task has no card linked".into()))?;

    // 2. Look up agent (persona needed for dispatcher system prompt)
    let agent = sqlx::query!(
        r#"SELECT name, persona, workspace_id FROM agents WHERE id = $1"#,
        agent_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Agent not found".into()))?;

    // 3. Look up card → board_id
    let card = sqlx::query!(
        r#"SELECT board_id, title FROM cards WHERE id = $1"#,
        card_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Card not found".into()))?;

    // 4. Generate agent-scoped JWT (1 hour)
    let token = crate::auth::jwt::generate_agent_jwt(agent_id, agent.workspace_id, &state.jwt_secret)?;
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);

    Ok(Json(TaskContextResponse {
        token,
        expires_at,
        agent_id,
        agent_name: agent.name,
        agent_persona: agent.persona,
        workspace_id: agent.workspace_id,
        board_id: card.board_id,
        card_id,
        card_title: card.title,
    }))
}
