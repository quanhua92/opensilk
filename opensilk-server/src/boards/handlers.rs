use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::jwt::AuthUser;
use crate::error::AppError;
use crate::state::AppState;

// --- Board types ---

#[derive(Debug, Serialize)]
pub struct BoardResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub column_config: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateBoardRequest {
    pub name: String,
    pub description: Option<String>,
    pub column_config: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct UpdateBoardRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

// --- Card types ---

#[derive(Debug, Serialize)]
pub struct CardResponse {
    pub id: Uuid,
    pub board_id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub assigned_agent_id: Option<Uuid>,
    pub priority: String,
    pub context_summary: Option<String>,
    pub position: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateCardRequest {
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub assigned_agent_id: Option<Uuid>,
    pub priority: Option<String>,
    pub context_summary: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateCardRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub assigned_agent_id: Option<Option<Uuid>>,
    pub priority: Option<String>,
    pub context_summary: Option<String>,
    pub position: Option<i32>,
}

#[derive(Deserialize)]
pub struct ListCardsQuery {
    pub status: Option<String>,
}

// --- Card agent types ---

#[derive(Debug, Serialize)]
pub struct CardAgentResponse {
    pub card_id: Uuid,
    pub agent_id: Uuid,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct AddCardAgentRequest {
    pub agent_id: Uuid,
    pub role: Option<String>,
}

// --- Comment types ---

#[derive(Debug, Serialize)]
pub struct CardCommentResponse {
    pub id: Uuid,
    pub card_id: Uuid,
    pub author_type: String,
    pub author_id: Uuid,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateCommentRequest {
    pub content: String,
}

// --- Attachment types ---

#[derive(Debug, Serialize)]
pub struct CardAttachmentResponse {
    pub id: Uuid,
    pub card_id: Uuid,
    pub file_name: String,
    pub file_url: String,
    pub file_size: Option<i64>,
    pub content_type: Option<String>,
    pub uploaded_by: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateAttachmentRequest {
    pub file_name: String,
    pub file_url: String,
    pub file_size: Option<i64>,
    pub content_type: Option<String>,
}

// --- Helper ---

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

// --- Board handlers ---

pub async fn create_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<CreateBoardRequest>,
) -> Result<(StatusCode, Json<BoardResponse>), AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let column_config = req
        .column_config
        .unwrap_or(serde_json::json!(["inbox","planning","ready","in_progress","review","done"]));

    let row = sqlx::query_as!(
        BoardResponse,
        r#"INSERT INTO boards (workspace_id, name, description, column_config)
        VALUES ($1, $2, $3, $4)
        RETURNING id, workspace_id, name, description, column_config, created_at, updated_at"#,
        workspace_id,
        req.name,
        req.description,
        column_config,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list_boards(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<BoardResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = sqlx::query_as!(
        BoardResponse,
        r#"SELECT id, workspace_id, name, description, column_config, created_at, updated_at
           FROM boards WHERE workspace_id = $1 ORDER BY created_at DESC"#,
        workspace_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn get_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<BoardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        BoardResponse,
        r#"SELECT id, workspace_id, name, description, column_config, created_at, updated_at
           FROM boards WHERE id = $1 AND workspace_id = $2"#,
        board_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Board not found".into()))?;

    Ok(Json(row))
}

pub async fn update_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateBoardRequest>,
) -> Result<Json<BoardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        BoardResponse,
        r#"UPDATE boards
           SET name = COALESCE($3, name),
               description = COALESCE($4, description),
               updated_at = NOW()
           WHERE id = $1 AND workspace_id = $2
           RETURNING id, workspace_id, name, description, column_config, created_at, updated_at"#,
        board_id,
        workspace_id,
        req.name,
        req.description,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Board not found".into()))?;

    Ok(Json(row))
}

pub async fn delete_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<BoardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        BoardResponse,
        r#"DELETE FROM boards
           WHERE id = $1 AND workspace_id = $2
           RETURNING id, workspace_id, name, description, column_config, created_at, updated_at"#,
        board_id,
        workspace_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Board not found".into()))?;

    Ok(Json(row))
}

// --- Card handlers ---

pub async fn create_card(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<CreateCardRequest>,
) -> Result<(StatusCode, Json<CardResponse>), AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        CardResponse,
        r#"INSERT INTO cards (board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at"#,
        board_id,
        workspace_id,
        req.title,
        req.description,
        req.status.as_deref().unwrap_or("inbox"),
        req.assigned_agent_id,
        req.priority.as_deref().unwrap_or("none"),
        req.context_summary,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list_cards(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<ListCardsQuery>,
) -> Result<Json<Vec<CardResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = match &params.status {
        Some(status) => {
            sqlx::query_as!(
                CardResponse,
                r#"SELECT id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at
                   FROM cards WHERE board_id = $1 AND status = $2 ORDER BY position, created_at"#,
                board_id,
                status,
            )
            .fetch_all(&state.pool)
            .await?
        }
        None => {
            sqlx::query_as!(
                CardResponse,
                r#"SELECT id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at
                   FROM cards WHERE board_id = $1 ORDER BY position, created_at"#,
                board_id,
            )
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(rows))
}

pub async fn get_card(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<CardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        CardResponse,
        r#"SELECT id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at
           FROM cards WHERE id = $1 AND board_id = $2"#,
        card_id,
        board_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Card not found".into()))?;

    Ok(Json(row))
}

pub async fn update_card(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(req): Json<UpdateCardRequest>,
) -> Result<Json<CardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    // Fetch old status for Redis event before update
    let old_card = sqlx::query_scalar!(
        r#"SELECT status AS "status!" FROM cards WHERE id = $1 AND board_id = $2"#,
        card_id,
        board_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Card not found".into()))?;

    let old_status = old_card;

    let row = sqlx::query_as!(
        CardResponse,
        r#"UPDATE cards
           SET title = COALESCE($3, title),
               description = COALESCE($4, description),
               status = COALESCE($5, status),
               assigned_agent_id = COALESCE($6, assigned_agent_id),
               priority = COALESCE($7, priority),
               context_summary = COALESCE($8, context_summary),
               position = COALESCE($9, position),
               updated_at = NOW()
           WHERE id = $1 AND board_id = $2
           RETURNING id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at"#,
        card_id,
        board_id,
        req.title,
        req.description,
        req.status,
        req.assigned_agent_id.flatten(),
        req.priority,
        req.context_summary,
        req.position,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Card not found".into()))?;

    // Publish Redis event when status changes
    let new_status = &row.status;
    if old_status != *new_status {
        let event = serde_json::json!({
            "event_type": "status_changed",
            "card_id": card_id,
            "board_id": board_id,
            "workspace_id": workspace_id,
            "old_status": old_status,
            "new_status": new_status,
        });
        let _: String = state
            .redis
            .xadd("cards:events", false, None, "*", ("data", event.to_string()))
            .await
            .map_err(|e| AppError::Internal(format!("Redis publish failed: {}", e)))?;
    }

    Ok(Json(row))
}

pub async fn delete_card(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<CardResponse>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let row = sqlx::query_as!(
        CardResponse,
        r#"DELETE FROM cards
           WHERE id = $1 AND board_id = $2
           RETURNING id, board_id, workspace_id, title, description, status, assigned_agent_id, priority, context_summary, position, created_at, updated_at"#,
        card_id,
        board_id,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Card not found".into()))?;

    Ok(Json(row))
}

// --- Card agent handlers ---

pub async fn list_card_agents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<Vec<CardAgentResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = sqlx::query_as!(
        CardAgentResponse,
        r#"SELECT ca.card_id, ca.agent_id, ca.role, ca.created_at
           FROM card_agents ca
           JOIN cards c ON c.id = ca.card_id
           WHERE ca.card_id = $1 AND c.board_id = $2"#,
        card_id,
        board_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn add_card_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(req): Json<AddCardAgentRequest>,
) -> Result<(StatusCode, Json<CardAgentResponse>), AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let role = req.role.as_deref().unwrap_or("member");

    let row = sqlx::query_as!(
        CardAgentResponse,
        r#"INSERT INTO card_agents (card_id, agent_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (card_id, agent_id) DO NOTHING
        RETURNING card_id, agent_id, role, created_at"#,
        card_id,
        req.agent_id,
        role,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Conflict("Agent already on this card".into()))?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn remove_card_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id, agent_id)): Path<(Uuid, Uuid, Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let result = sqlx::query!(
        r#"DELETE FROM card_agents WHERE card_id = $1 AND agent_id = $2"#,
        card_id,
        agent_id,
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Card agent not found".into()));
    }

    Ok(StatusCode::OK)
}

// --- Comment handlers ---

pub async fn list_comments(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<Vec<CardCommentResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = sqlx::query_as!(
        CardCommentResponse,
        r#"SELECT id, card_id, author_type, author_id, content, created_at
           FROM card_comments
           WHERE card_id = $1
           ORDER BY created_at ASC"#,
        card_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_comment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<(StatusCode, Json<CardCommentResponse>), AppError> {
    let (author_type, author_id) = match &user {
        AuthUser::User { user_id } => ("user", *user_id),
        AuthUser::Agent { agent_id, .. } => ("agent", *agent_id),
    };

    // For user scope, verify workspace ownership
    if let AuthUser::User { .. } = &user {
        verify_workspace_ownership(&state.pool, workspace_id, author_id).await?;
    }

    let row = sqlx::query_as!(
        CardCommentResponse,
        r#"INSERT INTO card_comments (card_id, author_type, author_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, card_id, author_type, author_id, content, created_at"#,
        card_id,
        author_type,
        author_id,
        req.content,
    )
    .fetch_one(&state.pool)
    .await?;

    // Publish Redis event
    let event = serde_json::json!({
        "event_type": "comment_added",
        "card_id": card_id,
        "board_id": board_id,
        "workspace_id": workspace_id,
        "author_type": author_type,
    });
    let _: String = state
        .redis
        .xadd("cards:events", false, None, "*", ("data", event.to_string()))
        .await
        .map_err(|e| AppError::Internal(format!("Redis publish failed: {}", e)))?;

    Ok((StatusCode::CREATED, Json(row)))
}

// --- Attachment handlers ---

pub async fn list_attachments(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<Vec<CardAttachmentResponse>>, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let rows = sqlx::query_as!(
        CardAttachmentResponse,
        r#"SELECT id, card_id, file_name, file_url, file_size, content_type, uploaded_by, created_at
           FROM card_attachments WHERE card_id = $1 ORDER BY created_at DESC"#,
        card_id,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn create_attachment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(req): Json<CreateAttachmentRequest>,
) -> Result<(StatusCode, Json<CardAttachmentResponse>), AppError> {
    let (author_type, uploaded_by) = match &user {
        AuthUser::User { user_id } => ("user", *user_id),
        AuthUser::Agent { agent_id, .. } => ("agent", *agent_id),
    };

    if let AuthUser::User { .. } = &user {
        verify_workspace_ownership(&state.pool, workspace_id, uploaded_by).await?;
    }

    let row = sqlx::query_as!(
        CardAttachmentResponse,
        r#"INSERT INTO card_attachments (card_id, file_name, file_url, file_size, content_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, card_id, file_name, file_url, file_size, content_type, uploaded_by, created_at"#,
        card_id,
        req.file_name,
        req.file_url,
        req.file_size,
        req.content_type,
        uploaded_by,
    )
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn delete_attachment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((workspace_id, board_id, card_id, attachment_id)): Path<(Uuid, Uuid, Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let user_id = user.require_user_id()?;
    verify_workspace_ownership(&state.pool, workspace_id, user_id).await?;

    let result = sqlx::query!(
        r#"DELETE FROM card_attachments WHERE id = $1 AND card_id = $2"#,
        attachment_id,
        card_id,
    )
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Attachment not found".into()));
    }

    Ok(StatusCode::OK)
}
