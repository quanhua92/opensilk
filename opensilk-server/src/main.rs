mod auth;
mod db;
mod error;
mod state;
mod workspaces;

#[tokio::main]
async fn main() {
    // Load .env from opensilk-server/ directory
    dotenvy::from_filename(".env").ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = db::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    db::health_check(&pool)
        .await
        .expect("Database health check failed");

    tracing::info!("Connected to database");
}
