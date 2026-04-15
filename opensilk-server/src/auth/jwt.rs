use axum::http::HeaderValue;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

fn default_scope() -> String {
    "user".into()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    #[serde(default = "default_scope")]
    pub scope: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ws: Option<String>,
}

pub fn generate_jwt(
    user_id: Uuid,
    secret: &str,
    scope: Option<&str>,
    workspace_id: Option<&str>,
) -> Result<String, AppError> {
    let now = Utc::now();
    let expiration = now + chrono::Duration::hours(24);

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration.timestamp(),
        iat: now.timestamp(),
        scope: scope.unwrap_or("user").to_string(),
        ws: workspace_id.map(|s| s.to_string()),
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {}", e)))
}

pub fn generate_agent_jwt(agent_id: Uuid, workspace_id: Uuid, secret: &str) -> Result<String, AppError> {
    let now = Utc::now();
    let expiration = now + chrono::Duration::hours(1);

    let claims = Claims {
        sub: agent_id.to_string(),
        exp: expiration.timestamp(),
        iat: now.timestamp(),
        scope: "agent".into(),
        ws: Some(workspace_id.to_string()),
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|e| AppError::Internal(format!("Failed to generate agent JWT: {}", e)))
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, AppError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|e| {
        let msg = e.to_string().to_lowercase();
        if msg.contains("expired") {
            AppError::Auth("Token has expired".into())
        } else if msg.contains("signature") {
            AppError::Auth("Invalid token signature".into())
        } else {
            AppError::Auth(format!("Invalid token: {}", e))
        }
    })?;

    Ok(token_data.claims)
}

pub fn build_cookie(token: &str) -> String {
    format!(
        "access_token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400",
        token
    )
}

pub fn clear_cookie() -> String {
    "access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0".to_string()
}

fn extract_cookie_value(cookie_str: &str, cookie_name: &str) -> Option<String> {
    cookie_str
        .split(';')
        .map(|s| s.trim())
        .find(|c| c.starts_with(&format!("{}=", cookie_name)))
        .and_then(|c| c.split('=').nth(1).map(|s| s.to_string()))
}

pub fn parse_access_token_from_headers(
    auth_header: Option<&HeaderValue>,
    cookie_header: Option<&HeaderValue>,
) -> Result<String, AppError> {
    // Priority 1: Authorization: Bearer <token>
    if let Some(header) = auth_header.and_then(|h| h.to_str().ok()) {
        if let Some(token) = header.strip_prefix("Bearer ") {
            if !token.is_empty() {
                return Ok(token.to_string());
            }
        }
    }

    // Priority 2: Cookie: access_token=<token>
    if let Some(cookie_str) = cookie_header.and_then(|h| h.to_str().ok()) {
        if let Some(token) = extract_cookie_value(cookie_str, "access_token") {
            return Ok(token);
        }
    }

    Err(AppError::Auth(
        "Missing access token. Provide Authorization: Bearer <token> header or access_token cookie".into(),
    ))
}

use axum::extract::Request;
use axum::http::HeaderMap;
use axum::middleware::Next;
use axum::response::Response;
use std::sync::Arc;
use axum::extract::State;

use crate::state::AppState;

#[derive(Debug, Clone)]
pub enum AuthUser {
    User { user_id: Uuid },
    Agent { agent_id: Uuid, workspace_id: Uuid },
}

impl AuthUser {
    pub fn require_user_id(&self) -> Result<Uuid, AppError> {
        match self {
            AuthUser::User { user_id } => Ok(*user_id),
            AuthUser::Agent { .. } => Err(AppError::Auth("user scope required".into())),
        }
    }
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = parse_access_token_from_headers(headers.get("authorization"), headers.get("cookie"))?;
    let claims = verify_jwt(&token, &state.jwt_secret)?;

    match claims.scope.as_str() {
        "agent" => {
            let workspace_id = claims.ws
                .ok_or(AppError::Auth("Missing workspace claim for agent scope".into()))?;

            let agent_id = Uuid::parse_str(&claims.sub)
                .map_err(|_| AppError::Auth("Invalid agent_id in token".into()))?;

            let workspace_uuid = Uuid::parse_str(&workspace_id)
                .map_err(|_| AppError::Auth("Invalid workspace_id in token".into()))?;

            // Verify agent exists in this workspace
            let exists: bool = sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1 AND workspace_id = $2) AS "exists!""#,
                agent_id,
                workspace_uuid,
            )
            .fetch_one(&state.pool)
            .await?;

            if !exists {
                return Err(AppError::Auth("Agent not found in workspace".into()));
            }

            request.extensions_mut().insert(AuthUser::Agent {
                agent_id,
                workspace_id: workspace_uuid,
            });
        }
        _ => {
            let user_id = Uuid::parse_str(&claims.sub)
                .map_err(|_| AppError::Auth("Invalid user_id in token".into()))?;

            request.extensions_mut().insert(AuthUser::User { user_id });
        }
    }

    Ok(next.run(request).await)
}
