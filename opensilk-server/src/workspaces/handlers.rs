use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

use crate::auth::jwt::AuthUser;

#[derive(serde::Serialize)]
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<(StatusCode, Json<WorkspaceResponse>), AppError> {
    let row = sqlx::query_as!(
        WorkspaceResponse,
        r#"INSERT INTO workspaces (name, owner_id)
        VALUES ($1, $2)
        RETURNING id, name, owner_id, created_at, updated_at"#,
        req.name,
        user.require_user_id()?,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Vec<WorkspaceResponse>>, AppError> {
    let rows = sqlx::query_as!(
        WorkspaceResponse,
        r#"SELECT id, name, owner_id, created_at, updated_at
        FROM workspaces
        WHERE owner_id = $1
        ORDER BY created_at DESC"#,
        user.require_user_id()?,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceResponse>, AppError> {
    let row = sqlx::query_as!(
        WorkspaceResponse,
        r#"SELECT id, name, owner_id, created_at, updated_at
        FROM workspaces
        WHERE id = $1 AND owner_id = $2"#,
        id,
        user.require_user_id()?,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Workspace not found".into()))?;

    Ok(Json(row))
}
