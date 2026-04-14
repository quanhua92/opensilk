use sqlx::PgPool;

pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
}
