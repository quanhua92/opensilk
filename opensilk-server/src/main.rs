mod auth;
mod db;
mod error;
mod state;
mod tasks;
mod workers;
mod workspaces;

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::routing::{get, patch};
use axum::{Router, Json};
use serde_json::json;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::error::AppError;
use crate::state::{AppState, RedisClient};
use fred::prelude::*;

#[tokio::main]
async fn main() {
    dotenvy::from_filename(".env").ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let pool = db::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Connected to database");

    let redis_url = std::env::var("REDIS_URL")
        .expect("REDIS_URL must be set");
    let config = Config::from_url(&redis_url).expect("Invalid REDIS_URL");
    let redis_client = RedisClient::new(config, None, None, None);
    let _handle = redis_client.connect();
    match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        redis_client.wait_for_connect(),
    )
    .await
    {
        Ok(Ok(())) => tracing::info!("Connected to Redis"),
        Ok(Err(e)) => tracing::warn!("Redis initial connect failed: {e} (fred will retry)"),
        Err(_) => tracing::warn!("Redis connect timed out (fred will retry)"),
    }

    let worker_tokens: Vec<String> = std::env::var("WORKER_TOKEN")
        .unwrap_or_default()
        .split(',')
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();

    let state = Arc::new(AppState {
        pool,
        jwt_secret,
        redis: redis_client,
        worker_tokens,
    });

    // Spawn background recovery worker for orphaned tasks
    let recovery_pool = state.pool.clone();
    let recovery_redis = state.redis.clone();
    let recovery_interval: u64 = std::env::var("RECOVERY_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    tokio::spawn(async move {
        workers::recovery::run(recovery_pool, recovery_redis, recovery_interval).await;
    });

    let app = Router::new()
        .route("/health", get(health))
        .nest("/auth", auth::auth_routes(state.clone()))
        .nest("/workspaces", workspaces::workspace_routes(state.clone()))
        .nest(
            "/worker",
            Router::new()
                .route("/tasks", get(tasks::worker_handlers::list_all).patch(tasks::worker_handlers::update_task))
                .route("/tasks/{task_id}", patch(tasks::worker_handlers::update_task))
                .route_layer(axum::middleware::from_fn_with_state(state.clone(), worker_auth))
                .with_state(state.clone()),
        )
        .with_state(state)
        .layer(CorsLayer::permissive());

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".into())
        .parse()
        .expect("PORT must be a number");

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .expect("Failed to bind to port");

    tracing::info!("Server listening on port {}", port);
    axum::serve(listener, app)
        .await
        .expect("Server error");
}

async fn health(State(state): State<Arc<AppState>>) -> Result<(), AppError> {
    db::health_check(&state.pool).await?;
    Ok(())
}

/// Worker auth middleware: validates Bearer token against WORKER_TOKEN env var (comma-separated).
async fn worker_auth(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    request: axum::extract::Request,
    next: Next,
) -> Result<axum::response::Response, (StatusCode, Json<serde_json::Value>)> {
    if state.worker_tokens.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": 401, "message": "Worker token not configured on server"})),
        ));
    }

    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = auth_header
        .strip_prefix("Bearer ")
        .unwrap_or("");

    if !state.worker_tokens.contains(&token.to_string()) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": 401, "message": "Invalid worker token"})),
        ));
    }

    Ok(next.run(request).await)
}
