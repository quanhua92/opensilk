mod auth;
mod db;
mod error;
mod state;
mod tasks;
mod workspaces;

use axum::extract::State;
use axum::routing::get;
use axum::Router;
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

    let state = Arc::new(AppState {
        pool,
        jwt_secret,
        redis: redis_client,
    });

    let app = Router::new()
        .route("/health", get(health))
        .nest("/auth", auth::auth_routes())
        .nest("/workspaces", workspaces::workspace_routes(state.clone()))
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
