pub mod handlers;

use axum::routing::{get, post};
use axum::{middleware, Router};
use std::sync::Arc;

use crate::auth::jwt::auth_middleware;
use crate::state::AppState;

pub fn workspace_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(handlers::create).get(handlers::list))
        .route("/{id}", get(handlers::get))
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
