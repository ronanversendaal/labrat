//! Cache management Tauri commands
//!
//! This module contains all cache-related IPC commands.

use crate::{SharedAppState, TauriError, TauriResult};
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_size_bytes: u64,
    pub mr_count: u32,
    pub diff_count: u32,
    pub suggestion_count: u32,
    pub oldest_entry: Option<String>,
    pub newest_entry: Option<String>,
}

/// Request to clear cache
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClearCacheRequest {
    #[serde(default)]
    pub merge_requests: bool,
    #[serde(default)]
    pub diffs: bool,
    #[serde(default)]
    pub suggestions: bool,
    #[serde(default)]
    pub all: bool,
}

/// Response from evicting old cache entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvictCacheResponse {
    pub evicted_count: u32,
    pub freed_bytes: u64,
}

// ============================================================================
// Inner functions — shared by Tauri + HTTP
// ============================================================================

/// Get cache statistics (inner)
pub async fn get_stats_inner(state: &SharedAppState) -> TauriResult<CacheStats> {
    let state = state.read().await;

    // Count merge requests
    let (mr_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM merge_requests")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Count diffs
    let (diff_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM diffs")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Count suggestions
    let (suggestion_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ai_suggestions")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Get oldest and newest entries from MRs
    // Aggregate functions always return one row; the value is NULL when the table is empty,
    // so we must decode as Option<String>.
    let (oldest_entry,): (Option<String>,) = sqlx::query_as(
        "SELECT MIN(cached_at) FROM merge_requests WHERE cached_at IS NOT NULL",
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let (newest_entry,): (Option<String>,) = sqlx::query_as(
        "SELECT MAX(cached_at) FROM merge_requests WHERE cached_at IS NOT NULL",
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Estimate size (rough calculation based on typical row sizes)
    let estimated_size = (mr_count * 2000 + diff_count * 50000 + suggestion_count * 1000) as u64;

    Ok(CacheStats {
        total_size_bytes: estimated_size,
        mr_count: mr_count as u32,
        diff_count: diff_count as u32,
        suggestion_count: suggestion_count as u32,
        oldest_entry,
        newest_entry,
    })
}

/// Clear the cache (inner)
pub async fn clear_inner(
    state: &SharedAppState,
    request: ClearCacheRequest,
) -> TauriResult<()> {
    let state = state.read().await;

    if request.all {
        // Clear all cache tables
        sqlx::query("DELETE FROM merge_requests")
            .execute(&state.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        sqlx::query("DELETE FROM diffs")
            .execute(&state.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        sqlx::query("DELETE FROM ai_suggestions")
            .execute(&state.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        info!("Cleared all cache");
    } else {
        if request.merge_requests {
            sqlx::query("DELETE FROM merge_requests")
                .execute(&state.db_pool)
                .await
                .map_err(|e| TauriError::cache_error(e.to_string()))?;
            info!("Cleared merge requests cache");
        }
        if request.diffs {
            sqlx::query("DELETE FROM diffs")
                .execute(&state.db_pool)
                .await
                .map_err(|e| TauriError::cache_error(e.to_string()))?;
            info!("Cleared diffs cache");
        }
        if request.suggestions {
            sqlx::query("DELETE FROM ai_suggestions")
                .execute(&state.db_pool)
                .await
                .map_err(|e| TauriError::cache_error(e.to_string()))?;
            info!("Cleared AI suggestions cache");
        }
    }

    Ok(())
}

/// Evict old cache entries (inner)
pub async fn evict_old_inner(state: &SharedAppState) -> TauriResult<EvictCacheResponse> {
    let state_guard = state.read().await;

    // Get settings to determine cache limit
    let cache_limit_mb: i32 = sqlx::query_scalar("SELECT cache_size_mb FROM settings WHERE id = 1")
        .fetch_optional(&state_guard.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?
        .unwrap_or(500);

    let cache_limit_bytes = cache_limit_mb as u64 * 1024 * 1024;

    // Get current estimated size
    let stats = {
        let (mr_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM merge_requests")
            .fetch_one(&state_guard.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        let (diff_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM diffs")
            .fetch_one(&state_guard.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        let (suggestion_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ai_suggestions")
            .fetch_one(&state_guard.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
        (mr_count * 2000 + diff_count * 50000 + suggestion_count * 1000) as u64
    };

    let mut evicted_count = 0u32;
    let mut freed_bytes = 0u64;

    // Only evict if over limit
    if stats > cache_limit_bytes {
        let target_reduction = stats - cache_limit_bytes;

        // Start by evicting old diffs (largest entries)
        let diffs_to_delete = (target_reduction / 50000).min(100) as i64;
        if diffs_to_delete > 0 {
            let result = sqlx::query(
                "DELETE FROM diffs WHERE mr_id IN (
                    SELECT mr_id FROM diffs ORDER BY cached_at ASC LIMIT ?
                )",
            )
            .bind(diffs_to_delete)
            .execute(&state_guard.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;

            evicted_count += result.rows_affected() as u32;
            freed_bytes += result.rows_affected() * 50000;
        }

        // Then evict old merge requests if still over
        if freed_bytes < target_reduction {
            let mrs_to_delete = ((target_reduction - freed_bytes) / 2000).min(100) as i64;
            if mrs_to_delete > 0 {
                let result = sqlx::query(
                    "DELETE FROM merge_requests WHERE id IN (
                        SELECT id FROM merge_requests ORDER BY cached_at ASC LIMIT ?
                    )",
                )
                .bind(mrs_to_delete)
                .execute(&state_guard.db_pool)
                .await
                .map_err(|e| TauriError::cache_error(e.to_string()))?;

                evicted_count += result.rows_affected() as u32;
                freed_bytes += result.rows_affected() * 2000;
            }
        }

        info!(
            "Evicted {} cache entries, freed {} bytes",
            evicted_count, freed_bytes
        );
    }

    Ok(EvictCacheResponse {
        evicted_count,
        freed_bytes,
    })
}

// ============================================================================
// Tauri command wrappers
// ============================================================================

/// Get cache statistics
#[tauri::command]
pub async fn cache_get_stats(state: State<'_, SharedAppState>) -> TauriResult<CacheStats> {
    get_stats_inner(&state).await
}

/// Clear the cache
#[tauri::command]
pub async fn cache_clear(
    state: State<'_, SharedAppState>,
    request: ClearCacheRequest,
) -> TauriResult<()> {
    clear_inner(&state, request).await
}

/// Evict old cache entries to stay within size limit
#[tauri::command]
pub async fn cache_evict_old(state: State<'_, SharedAppState>) -> TauriResult<EvictCacheResponse> {
    evict_old_inner(&state).await
}
