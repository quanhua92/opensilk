use fred::prelude::*;
use sqlx::PgPool;

use crate::state::RedisClient;

pub async fn run(pool: PgPool, redis: RedisClient, interval_secs: u64) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;

        match recover_orphans(&pool, &redis).await {
            Ok((recovered, failed)) => {
                if recovered > 0 || failed > 0 {
                    tracing::info!(
                        "Recovery cycle: {} tasks recovered to pending, {} tasks permanently failed",
                        recovered,
                        failed,
                    );
                }
            }
            Err(e) => {
                tracing::error!("Recovery cycle error: {}", e);
            }
        }
    }
}

async fn recover_orphans(
    pool: &PgPool,
    redis: &RedisClient,
) -> Result<(u64, u64), sqlx::Error> {
    // Recover orphaned running tasks that still have retries left
    let recovered_rows = sqlx::query!(
        r#"UPDATE tasks
           SET status = 'pending',
               error_log = 'Recovered: worker heartbeat timeout',
               retry_count = retry_count + 1,
               updated_at = NOW()
           WHERE status = 'running'
             AND last_heartbeat_at < NOW() - INTERVAL '2 minutes'
             AND retry_count < max_retries
           RETURNING id, workspace_id, type AS "task_type", name"#,
    )
    .fetch_all(pool)
    .await?;

    // Notify agents via Redis Stream for each recovered task
    for row in &recovered_rows {
        let event = serde_json::json!({
            "task_id": row.id,
            "workspace_id": row.workspace_id,
            "type": row.task_type,
            "name": row.name,
        });
        if let Err(e) = redis
            .xadd::<String, _, _, _, _>("tasks:pending", false, None, "*", ("data", event.to_string()))
            .await
        {
            tracing::error!("Failed to publish recovered task {} to Redis: {}", row.id, e);
        }
    }

    let recovered_count = recovered_rows.len() as u64;

    // Fail orphaned running tasks that have exhausted retries
    let failed_rows = sqlx::query!(
        r#"UPDATE tasks
           SET status = 'failed',
               error_log = 'Recovered: worker heartbeat timeout, max retries exhausted',
               updated_at = NOW()
           WHERE status = 'running'
             AND last_heartbeat_at < NOW() - INTERVAL '2 minutes'
             AND retry_count >= max_retries
           RETURNING id"#,
    )
    .fetch_all(pool)
    .await?;

    let failed_count = failed_rows.len() as u64;

    Ok((recovered_count, failed_count))
}
