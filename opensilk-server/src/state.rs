use fred::prelude::*;
use sqlx::PgPool;

pub type RedisClient = Client;

pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
    pub redis: RedisClient,
    pub worker_tokens: Vec<String>,
}
