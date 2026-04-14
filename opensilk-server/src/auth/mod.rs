pub mod handlers;
pub mod jwt;

use axum::routing::post;
use axum::Router;
use std::sync::Arc;

use crate::state::AppState;

pub fn auth_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/logout", post(handlers::logout))
}
