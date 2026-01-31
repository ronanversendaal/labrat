//! Filter preset storage
//!
//! This module handles storage and retrieval of user-defined filter presets.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use thiserror::Error;
use uuid::Uuid;

use crate::gitlab::types::MergeRequestFilter;

/// Errors related to filter preset operations
#[derive(Debug, Error)]
pub enum FilterPresetError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Filter preset not found: {0}")]
    NotFound(String),
}

/// A saved filter preset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterPreset {
    pub id: String,
    pub name: String,
    pub filter: MergeRequestFilter,
    pub search_query: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Stored filter data (includes search query)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredFilter {
    filter: MergeRequestFilter,
    #[serde(default)]
    search_query: Option<String>,
}

impl FilterPreset {
    /// Create a new filter preset
    pub fn new(name: String, filter: MergeRequestFilter, search_query: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            filter,
            search_query,
            created_at: Utc::now(),
        }
    }
}

/// Filter preset storage operations
pub struct FilterPresetStore {
    pool: SqlitePool,
}

impl FilterPresetStore {
    /// Create a new filter preset store
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// List all filter presets
    pub async fn list(&self) -> Result<Vec<FilterPreset>, FilterPresetError> {
        let rows = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT id, name, filters_json, created_at FROM filter_presets ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await?;

        let presets = rows
            .into_iter()
            .filter_map(|(id, name, filters_json, created_at)| {
                let stored: StoredFilter = serde_json::from_str(&filters_json).ok()?;
                let created_at = DateTime::parse_from_rfc3339(&created_at).ok()?.with_timezone(&Utc);
                Some(FilterPreset {
                    id,
                    name,
                    filter: stored.filter,
                    search_query: stored.search_query,
                    created_at,
                })
            })
            .collect();

        Ok(presets)
    }

    /// Get a filter preset by ID
    pub async fn get(&self, id: &str) -> Result<FilterPreset, FilterPresetError> {
        let row = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT id, name, filters_json, created_at FROM filter_presets WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| FilterPresetError::NotFound(id.to_string()))?;

        let stored: StoredFilter = serde_json::from_str(&row.2)?;
        let created_at = DateTime::parse_from_rfc3339(&row.3)
            .map_err(|_| FilterPresetError::NotFound(id.to_string()))?
            .with_timezone(&Utc);

        Ok(FilterPreset {
            id: row.0,
            name: row.1,
            filter: stored.filter,
            search_query: stored.search_query,
            created_at,
        })
    }

    /// Save a filter preset
    pub async fn save(&self, preset: &FilterPreset) -> Result<(), FilterPresetError> {
        let stored = StoredFilter {
            filter: preset.filter.clone(),
            search_query: preset.search_query.clone(),
        };
        let filters_json = serde_json::to_string(&stored)?;

        sqlx::query(
            "INSERT OR REPLACE INTO filter_presets (id, name, filters_json, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&preset.id)
        .bind(&preset.name)
        .bind(&filters_json)
        .bind(preset.created_at.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Delete a filter preset
    pub async fn delete(&self, id: &str) -> Result<(), FilterPresetError> {
        let result = sqlx::query("DELETE FROM filter_presets WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(FilterPresetError::NotFound(id.to_string()));
        }

        Ok(())
    }

    /// Update a filter preset's name
    pub async fn rename(&self, id: &str, new_name: &str) -> Result<(), FilterPresetError> {
        let result = sqlx::query("UPDATE filter_presets SET name = ? WHERE id = ?")
            .bind(new_name)
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(FilterPresetError::NotFound(id.to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::db::Database;
    use tempfile::tempdir;

    async fn create_test_store() -> FilterPresetStore {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(db_path).await.unwrap();
        FilterPresetStore::new(db.pool().clone())
    }

    #[tokio::test]
    async fn test_save_and_list_presets() {
        let store = create_test_store().await;

        let filter = MergeRequestFilter {
            project_id: Some(123),
            is_draft: Some(false),
            ..Default::default()
        };

        let preset = FilterPreset::new("My Preset".to_string(), filter, Some("test".to_string()));
        store.save(&preset).await.unwrap();

        let presets = store.list().await.unwrap();
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0].name, "My Preset");
        assert_eq!(presets[0].filter.project_id, Some(123));
        assert_eq!(presets[0].search_query, Some("test".to_string()));
    }

    #[tokio::test]
    async fn test_delete_preset() {
        let store = create_test_store().await;

        let preset = FilterPreset::new("To Delete".to_string(), MergeRequestFilter::default(), None);
        let id = preset.id.clone();
        store.save(&preset).await.unwrap();

        // Verify it exists
        let presets = store.list().await.unwrap();
        assert_eq!(presets.len(), 1);

        // Delete it
        store.delete(&id).await.unwrap();

        // Verify it's gone
        let presets = store.list().await.unwrap();
        assert_eq!(presets.len(), 0);
    }
}
