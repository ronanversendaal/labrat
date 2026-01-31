//! Cache management Tauri commands
//!
//! This module contains all cache-related IPC commands.

use crate::TauriResult;
use serde::{Deserialize, Serialize};

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

/// Get cache statistics
#[tauri::command]
pub async fn cache_get_stats() -> TauriResult<CacheStats> {
    // TODO: Implement cache stats retrieval
    Ok(CacheStats {
        total_size_bytes: 0,
        mr_count: 0,
        diff_count: 0,
        suggestion_count: 0,
        oldest_entry: None,
        newest_entry: None,
    })
}

/// Clear the cache
#[tauri::command]
pub async fn cache_clear(request: ClearCacheRequest) -> TauriResult<()> {
    // TODO: Implement cache clearing
    let _ = request;
    Ok(())
}

/// Evict old cache entries to stay within size limit
#[tauri::command]
pub async fn cache_evict_old() -> TauriResult<EvictCacheResponse> {
    // TODO: Implement cache eviction
    Ok(EvictCacheResponse {
        evicted_count: 0,
        freed_bytes: 0,
    })
}
