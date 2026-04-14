use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use fred::prelude::*;
use rmcp::model::{ListToolsResult, Tool, ToolAnnotations};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::jwt::AuthUser;
use crate::error::AppError;
use crate::state::AppState;

// --- Response type ---

#[derive(Debug, Serialize)]
pub struct TaskResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    #[serde(rename = "type")]
    pub task_type: String,
    pub name: String,
    pub status: String,
    pub retry_count: i32,
    pub max_retries: i32,
    pub last_heartbeat_at: chrono::DateTime<chrono::Utc>,
    pub input_data: Option<serde_json::Value>,
    pub output_data: Option<serde_json::Value>,
    pub error_log: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// --- Request types ---

#[derive(Deserialize)]
pub struct CreateTaskRequest {
    #[serde(rename = "type")]
    pub task_type: String,
    pub name: String,
    pub input_data: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct ListTasksQuery {
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTaskRequest {
    pub status: Option<String>,
    pub output_data: Option<serde_json::Value>,
    pub error_log: Option<String>,
    pub retry: Option<bool>,
}

// --- MCP Tool Registry: input schema structs ---

#[derive(Deserialize, JsonSchema)]
#[allow(dead_code)]
pub struct HelloAgentsInput {
    #[schemars(description = "Name to greet")]
    pub name: Option<String>,
}

// --- MCP Tool Registry: handlers ---

pub async fn list_workflows(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<ListToolsResult>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    let tool = Tool::new("hello_agents", "Multi-step LangGraph workflow: greet, assess mood, branch to response", serde_json::Map::new())
        .with_input_schema::<HelloAgentsInput>()
        .with_title("Hello Agents")
        .annotate(
            ToolAnnotations::with_title("Hello Agents")
                .read_only(true)
                .destructive(false)
                .open_world(true),
        );

    Ok(Json(ListToolsResult::with_all_items(vec![tool])))
}

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<ListToolsResult>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    let tool = Tool::new("openclaw", "Placeholder autonomous agent", serde_json::Map::new())
        .with_title("OpenClaw")
        .annotate(
            ToolAnnotations::with_title("OpenClaw")
                .read_only(true)
                .destructive(false)
                .open_world(true),
        );

    Ok(Json(ListToolsResult::with_all_items(vec![tool])))
}

// --- Helper: verify workspace ownership ---

async fn verify_workspace_ownership(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND owner_id = $2) AS "exists!""#,
        workspace_id,
        user_id,
    )
    .fetch_one(pool)
    .await?;

    if !exists {
        Err(AppError::NotFound("Workspace not found".into()))
    } else {
        Ok(())
    }
}

// --- Handlers ---

pub async fn create(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<TaskResponse>), AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    if req.task_type != "workflow" && req.task_type != "agent" {
        return Err(AppError::Auth(
            "type must be 'workflow' or 'agent'".into(),
        ));
    }

    let row = sqlx::query_as!(
        TaskResponse,
        r#"INSERT INTO tasks (workspace_id, type, name, input_data)
        VALUES ($1, $2, $3, $4)
        RETURNING id, workspace_id, type AS "task_type", name, status,
                  retry_count, max_retries, last_heartbeat_at,
                  input_data, output_data, error_log, created_at, updated_at"#,
        workspace_id,
        req.task_type,
        req.name,
        req.input_data,
    )
    .fetch_one(&state.pool)
    .await?;

    // Publish to Redis Stream for instant worker notification
    let event = serde_json::json!({
        "task_id": row.id,
        "workspace_id": workspace_id,
        "type": req.task_type,
        "name": req.name,
    });
    let _: String = state
        .redis
        .xadd("tasks:pending", false, None, "*", ("data", event.to_string()))
        .await
        .map_err(|e| AppError::Internal(format!("Redis publish failed: {}", e)))?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Query(params): Query<ListTasksQuery>,
) -> Result<Json<Vec<TaskResponse>>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    let rows = match params.status {
        Some(ref status) => {
            sqlx::query_as!(
                TaskResponse,
                r#"SELECT id, workspace_id, type AS "task_type", name, status,
                          retry_count, max_retries, last_heartbeat_at,
                          input_data, output_data, error_log, created_at, updated_at
                   FROM tasks
                   WHERE workspace_id = $1 AND status = $2
                   ORDER BY created_at DESC"#,
                workspace_id,
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
                   WHERE workspace_id = $1
                   ORDER BY created_at DESC"#,
                workspace_id,
            )
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(rows))
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, task_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<TaskResponse>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    let row = sqlx::query_as!(
        TaskResponse,
        r#"SELECT id, workspace_id, type AS "task_type", name, status,
                  retry_count, max_retries, last_heartbeat_at,
                  input_data, output_data, error_log, created_at, updated_at
           FROM tasks
           WHERE id = $1 AND workspace_id = $2"#,
        task_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Task not found".into()))?;

    Ok(Json(row))
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, task_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    // Retry logic: when retry=true and current status is running,
    // check retry_count against max_retries server-side
    if req.retry == Some(true) {
        // Fetch current task to check retry count
        let row = sqlx::query!(
            r#"SELECT retry_count, max_retries
               FROM tasks WHERE id = $1 AND workspace_id = $2"#,
            task_id,
            workspace_id,
        )
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound("Task not found".into()))?;

        if row.retry_count + 1 >= row.max_retries {
            // Max retries exhausted — mark as failed
            let row = sqlx::query_as!(
                TaskResponse,
                r#"UPDATE tasks
                   SET status = 'failed',
                       retry_count = retry_count + 1,
                       error_log = COALESCE($3, error_log),
                       last_heartbeat_at = NOW(),
                       updated_at = NOW()
                   WHERE id = $1 AND workspace_id = $2
                   RETURNING id, workspace_id, type AS "task_type", name, status,
                             retry_count, max_retries, last_heartbeat_at,
                             input_data, output_data, error_log, created_at, updated_at"#,
                task_id,
                workspace_id,
                req.error_log,
            )
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::NotFound("Task not found".into()))?;

            return Ok(Json(row));
        } else {
            // Reset to pending with incremented retry count
            let row = sqlx::query_as!(
                TaskResponse,
                r#"UPDATE tasks
                   SET status = 'pending',
                       retry_count = retry_count + 1,
                       error_log = COALESCE($3, error_log),
                       last_heartbeat_at = NOW(),
                       updated_at = NOW()
                   WHERE id = $1 AND workspace_id = $2
                   RETURNING id, workspace_id, type AS "task_type", name, status,
                             retry_count, max_retries, last_heartbeat_at,
                             input_data, output_data, error_log, created_at, updated_at"#,
                task_id,
                workspace_id,
                req.error_log,
            )
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::NotFound("Task not found".into()))?;

            return Ok(Json(row));
        }
    }

    // Standard update: use COALESCE so None fields don't overwrite
    let row = sqlx::query_as!(
        TaskResponse,
        r#"UPDATE tasks
           SET status = COALESCE($3, status),
               output_data = COALESCE($4, output_data),
               error_log = COALESCE($5, error_log),
               last_heartbeat_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE last_heartbeat_at END,
               updated_at = NOW()
           WHERE id = $1 AND workspace_id = $2
           RETURNING id, workspace_id, type AS "task_type", name, status,
                     retry_count, max_retries, last_heartbeat_at,
                     input_data, output_data, error_log, created_at, updated_at"#,
        task_id,
        workspace_id,
        req.status,
        req.output_data,
        req.error_log,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Task not found".into()))?;

    Ok(Json(row))
}

pub async fn cancel(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, task_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<TaskResponse>, AppError> {
    verify_workspace_ownership(&state.pool, workspace_id, user.user_id).await?;

    let row = sqlx::query_as!(
        TaskResponse,
        r#"UPDATE tasks
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND workspace_id = $2 AND status IN ('pending', 'running')
           RETURNING id, workspace_id, type AS "task_type", name, status,
                     retry_count, max_retries, last_heartbeat_at,
                     input_data, output_data, error_log, created_at, updated_at"#,
        task_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound(
        "Task not found or not cancellable".into(),
    ))?;

    Ok(Json(row))
}
