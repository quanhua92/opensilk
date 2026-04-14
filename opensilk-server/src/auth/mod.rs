pub mod handlers;
pub mod jwt;

use axum::middleware;
use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;

use crate::auth::jwt::auth_middleware;
use crate::state::AppState;

pub fn auth_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let protected = Router::new()
        .route("/me", get(handlers::me))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/logout", post(handlers::logout))
        .merge(protected)
}
