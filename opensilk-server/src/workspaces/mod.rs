pub mod handlers;

use axum::routing::{get, post};
use axum::{middleware, Router};
use std::sync::Arc;

use crate::auth::jwt::auth_middleware;
use crate::state::AppState;
use crate::tasks;

pub fn workspace_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(handlers::create).get(handlers::list))
        .route("/{id}", get(handlers::get))
        // Task routes scoped under workspace
        .route("/{id}/tasks", post(tasks::handlers::create).get(tasks::handlers::list))
        .route(
            "/{id}/tasks/{task_id}",
            get(tasks::handlers::get).patch(tasks::handlers::update),
        )
        .route(
            "/{id}/tasks/{task_id}/cancel",
            post(tasks::handlers::cancel),
        )
        // MCP tool registry endpoint
        .route("/{id}/tasks/types", get(tasks::handlers::list_task_types))
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
