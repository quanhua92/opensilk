use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::jwt::AuthUser;
use crate::error::AppError;
use crate::state::AppState;

// --- Response type ---

#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub slug: String,
    pub persona: String,
    pub avatar_url: Option<String>,
    pub enabled_tools: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// --- Request types ---

#[derive(Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub slug: String,
    pub persona: Option<String>,
    pub avatar_url: Option<String>,
    pub enabled_tools: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct UpdateAgentRequest {
    pub name: Option<String>,
    pub persona: Option<String>,
    pub avatar_url: Option<String>,
    pub enabled_tools: Option<serde_json::Value>,
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
    Json(req): Json<CreateAgentRequest>,
) -> Result<(StatusCode, Json<AgentResponse>), AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let tools = req.enabled_tools.unwrap_or(serde_json::json!([]));

    let row = sqlx::query_as!(
        AgentResponse,
        r#"INSERT INTO agents (workspace_id, name, slug, persona, avatar_url, enabled_tools)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, workspace_id, name, slug, persona, avatar_url, enabled_tools, created_at, updated_at"#,
        workspace_id,
        req.name,
        req.slug,
        req.persona.as_deref().unwrap_or(""),
        req.avatar_url,
        tools,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().to_lowercase().contains("unique") {
            AppError::Conflict("Agent slug already exists in this workspace".into())
        } else {
            AppError::Sqlx(e)
        }
    })?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<AgentResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = sqlx::query_as!(
        AgentResponse,
        r#"SELECT id, workspace_id, name, slug, persona, avatar_url, enabled_tools, created_at, updated_at
           FROM agents
           WHERE workspace_id = $1
           ORDER BY created_at DESC"#,
        workspace_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, agent_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AgentResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        AgentResponse,
        r#"SELECT id, workspace_id, name, slug, persona, avatar_url, enabled_tools, created_at, updated_at
           FROM agents
           WHERE id = $1 AND workspace_id = $2"#,
        agent_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Agent not found".into()))?;

    Ok(Json(row))
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, agent_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateAgentRequest>,
) -> Result<Json<AgentResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        AgentResponse,
        r#"UPDATE agents
           SET name = COALESCE($3, name),
               persona = COALESCE($4, persona),
               avatar_url = COALESCE($5, avatar_url),
               enabled_tools = COALESCE($6, enabled_tools),
               updated_at = NOW()
           WHERE id = $1 AND workspace_id = $2
           RETURNING id, workspace_id, name, slug, persona, avatar_url, enabled_tools, created_at, updated_at"#,
        agent_id,
        workspace_id,
        req.name,
        req.persona,
        req.avatar_url,
        req.enabled_tools,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Agent not found".into()))?;

    Ok(Json(row))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, agent_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<AgentResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        AgentResponse,
        r#"DELETE FROM agents
           WHERE id = $1 AND workspace_id = $2
           RETURNING id, workspace_id, name, slug, persona, avatar_url, enabled_tools, created_at, updated_at"#,
        agent_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Agent not found".into()))?;

    Ok(Json(row))
}
