//! Diff content caching
//!
//! This module handles caching of merge request diffs in SQLite.

use chrono::{DateTime, Utc};
use serde_json;
use sqlx::SqlitePool;
use thiserror::Error;

use crate::gitlab::types::{Diff, DiffFile};

/// Errors related to diff cache operations
#[derive(Debug, Error)]
pub enum DiffCacheError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Diff not found for MR: {0}")]
    NotFound(i64),
}

/// Diff cache storage operations
pub struct DiffCache {
    pool: SqlitePool,
}

impl DiffCache {
    /// Create a new diff cache
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Get cached diff for a merge request
    pub async fn get(&self, mr_id: i64) -> Result<Option<Diff>, DiffCacheError> {
        let row = sqlx::query_as::<_, (String, String, String, String, String)>(
            "SELECT base_commit_sha, head_commit_sha, start_commit_sha, files_json, cached_at
             FROM diffs WHERE mr_id = ?",
        )
        .bind(mr_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((base_sha, head_sha, start_sha, files_json, cached_at)) => {
                let files: Vec<DiffFile> = serde_json::from_str(&files_json)?;
                let cached_at = DateTime::parse_from_rfc3339(&cached_at)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc));

                Ok(Some(Diff {
                    mr_id,
                    base_commit_sha: base_sha,
                    head_commit_sha: head_sha,
                    start_commit_sha: start_sha,
                    files,
                    cached_at,
                }))
            }
            None => Ok(None),
        }
    }

    /// Store diff in cache
    pub async fn store(&self, diff: &Diff) -> Result<(), DiffCacheError> {
        let files_json = serde_json::to_string(&diff.files)?;
        let cached_at = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT OR REPLACE INTO diffs
             (mr_id, base_commit_sha, head_commit_sha, start_commit_sha, files_json, cached_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(diff.mr_id)
        .bind(&diff.base_commit_sha)
        .bind(&diff.head_commit_sha)
        .bind(&diff.start_commit_sha)
        .bind(&files_json)
        .bind(&cached_at)
        .execute(&self.pool)
        .await?;

        // Also mark the MR as having cached diff
        sqlx::query("UPDATE merge_requests SET diff_cached = 1 WHERE id = ?")
            .bind(diff.mr_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Delete cached diff
    pub async fn delete(&self, mr_id: i64) -> Result<(), DiffCacheError> {
        sqlx::query("DELETE FROM diffs WHERE mr_id = ?")
            .bind(mr_id)
            .execute(&self.pool)
            .await?;

        sqlx::query("UPDATE merge_requests SET diff_cached = 0 WHERE id = ?")
            .bind(mr_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Check if diff is cached for a merge request
    pub async fn is_cached(&self, mr_id: i64) -> Result<bool, DiffCacheError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM diffs WHERE mr_id = ?")
            .bind(mr_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(count.0 > 0)
    }

    /// Get total size of cached diffs in bytes (approximate)
    pub async fn total_size_bytes(&self) -> Result<i64, DiffCacheError> {
        let size: (i64,) =
            sqlx::query_as("SELECT COALESCE(SUM(LENGTH(files_json)), 0) FROM diffs")
                .fetch_one(&self.pool)
                .await?;

        Ok(size.0)
    }

    /// Delete oldest diffs to reduce cache size
    pub async fn evict_oldest(&self, count: i32) -> Result<i32, DiffCacheError> {
        // First get the IDs of the oldest diffs
        let old_ids: Vec<(i64,)> = sqlx::query_as(
            "SELECT mr_id FROM diffs ORDER BY cached_at ASC LIMIT ?",
        )
        .bind(count)
        .fetch_all(&self.pool)
        .await?;

        let mut deleted = 0;
        for (mr_id,) in old_ids {
            self.delete(mr_id).await?;
            deleted += 1;
        }

        Ok(deleted)
    }

    /// Clear all cached diffs
    pub async fn clear(&self) -> Result<i64, DiffCacheError> {
        let result = sqlx::query("DELETE FROM diffs")
            .execute(&self.pool)
            .await?;

        sqlx::query("UPDATE merge_requests SET diff_cached = 0")
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() as i64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::db::Database;
    use tempfile::tempdir;

    async fn create_test_cache() -> DiffCache {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(db_path).await.unwrap();
        DiffCache::new(db.pool().clone())
    }

    #[tokio::test]
    async fn test_store_and_get_diff() {
        let cache = create_test_cache().await;

        let diff = Diff {
            mr_id: 123,
            base_commit_sha: "abc123".to_string(),
            head_commit_sha: "def456".to_string(),
            start_commit_sha: "ghi789".to_string(),
            files: vec![DiffFile {
                old_path: "file.rs".to_string(),
                new_path: "file.rs".to_string(),
                diff: "+added line".to_string(),
                new_file: false,
                renamed_file: false,
                deleted_file: false,
                generated_file: false,
                additions: 1,
                deletions: 0,
                highlighted_lines: None,
            }],
            cached_at: None,
        };

        cache.store(&diff).await.unwrap();

        let retrieved = cache.get(123).await.unwrap().unwrap();
        assert_eq!(retrieved.base_commit_sha, "abc123");
        assert_eq!(retrieved.files.len(), 1);
        assert!(retrieved.cached_at.is_some());
    }

    #[tokio::test]
    async fn test_is_cached() {
        let cache = create_test_cache().await;

        assert!(!cache.is_cached(999).await.unwrap());

        let diff = Diff {
            mr_id: 999,
            base_commit_sha: String::new(),
            head_commit_sha: String::new(),
            start_commit_sha: String::new(),
            files: vec![],
            cached_at: None,
        };

        cache.store(&diff).await.unwrap();
        assert!(cache.is_cached(999).await.unwrap());
    }
}
