use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::{Extension, State};
use axum::http::header::SET_COOKIE;
use axum::response::{IntoResponse, Response};
use axum::{http::StatusCode, Json};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

use super::jwt::{AuthUser, build_cookie, clear_cookie, generate_jwt};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub full_name: Option<String>,
}

#[derive(serde::Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    if req.email.trim().is_empty() {
        return Err(AppError::Auth("Email is required".into()));
    }
    if req.password.len() < 8 {
        return Err(AppError::Auth("Password must be at least 8 characters".into()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?
        .to_string();

    let row = sqlx::query_as!(
        UserResponse,
        r#"INSERT INTO users (email, password_hash, full_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, full_name, created_at"#,
        req.email,
        password_hash,
        req.full_name,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        if e.to_string().to_lowercase().contains("unique") {
            AppError::Conflict("Email already exists".into())
        } else {
            AppError::Sqlx(e)
        }
    })?;

    Ok((StatusCode::CREATED, Json(row)))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Response, AppError> {
    let user = sqlx::query_as!(
        UserResponse,
        r#"SELECT id, email, full_name, created_at FROM users WHERE email = $1"#,
        req.email,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Auth("Invalid email or password".into()))?;

    // We need the password_hash to verify — fetch it separately
    let password_hash: String = sqlx::query_scalar!(
        r#"SELECT password_hash FROM users WHERE email = $1"#,
        req.email,
    )
    .fetch_one(&state.pool)
    .await?;

    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| AppError::Internal("Invalid password hash stored".into()))?;

    if Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return Err(AppError::Auth("Invalid email or password".into()));
    }

    let token = generate_jwt(user.id, &state.jwt_secret, None, None)?;
    let cookie = build_cookie(&token);

    Ok((
        StatusCode::OK,
        [(SET_COOKIE, cookie)],
        Json(user),
    ).into_response())
}

pub async fn logout() -> Response {
    (
        StatusCode::OK,
        [(SET_COOKIE, clear_cookie())],
        Json(serde_json::json!({ "message": "logged out" })),
    )
        .into_response()
}

pub async fn me(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<UserResponse>, AppError> {
    let row = sqlx::query_as!(
        UserResponse,
        r#"SELECT id, email, full_name, created_at FROM users WHERE id = $1"#,
        user.require_user_id()?,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("User not found".into()))?;

    Ok(Json(row))
}
