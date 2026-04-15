pub mod handlers;

use axum::routing::{delete, get, patch, post};
use axum::{middleware, Router};
use std::sync::Arc;

use crate::agents;
use crate::auth::jwt::auth_middleware;
use crate::boards;
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
        // Board routes
        .route(
            "/{id}/boards",
            post(boards::handlers::create_board).get(boards::handlers::list_boards),
        )
        .route(
            "/{id}/boards/{board_id}",
            get(boards::handlers::get_board)
                .patch(boards::handlers::update_board)
                .delete(boards::handlers::delete_board),
        )
        // Card routes
        .route(
            "/{id}/boards/{board_id}/cards",
            post(boards::handlers::create_card).get(boards::handlers::list_cards),
        )
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}",
            get(boards::handlers::get_card)
                .patch(boards::handlers::update_card)
                .delete(boards::handlers::delete_card),
        )
        // Card agent routes
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}/agents",
            get(boards::handlers::list_card_agents).post(boards::handlers::add_card_agent),
        )
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}/agents/{agent_id}",
            delete(boards::handlers::remove_card_agent),
        )
        // Comment routes
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}/comments",
            get(boards::handlers::list_comments).post(boards::handlers::create_comment),
        )
        // Attachment routes
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}/attachments",
            get(boards::handlers::list_attachments).post(boards::handlers::create_attachment),
        )
        .route(
            "/{id}/boards/{board_id}/cards/{card_id}/attachments/{attachment_id}",
            delete(boards::handlers::delete_attachment),
        )
        .route_layer(middleware::from_fn_with_state(state, auth_middleware))
}
