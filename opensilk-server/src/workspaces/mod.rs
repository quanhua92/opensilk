pub mod handlers;

use axum::routing::{delete, get, patch, post};
use axum::{middleware, Router};
use std::sync::Arc;

use crate::agents;
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
        // Agent routes
        .route(
            "/{id}/agents",
            post(agents::handlers::create).get(agents::handlers::list),
        )
        .route(
            "/{id}/agents/{agent_id}",
            get(agents::handlers::get)
                .patch(agents::handlers::update)
                .delete(agents::handlers::delete),
        )
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
