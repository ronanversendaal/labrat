//! SQLite database operations
//!
//! This module provides database connection management and
//! migration handling for the application's SQLite database.

use std::path::PathBuf;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use thiserror::Error;
use tracing::{debug, info};

/// Database-related errors
#[derive(Debug, Error)]
pub enum DbError {
    #[error("Failed to create database directory: {0}")]
    DirectoryCreation(#[from] std::io::Error),

    #[error("Database connection error: {0}")]
    Connection(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    Migration(String),
}

/// Database connection manager
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection with the given path
    pub async fn new(db_path: PathBuf) -> Result<Self, DbError> {
        // Ensure the parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db_url = format!("sqlite:{}", db_path.display());
        debug!("Connecting to database: {}", db_url);

        // Configure connection options for optimal performance
        let connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(std::time::Duration::from_secs(30));

        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .min_connections(1)
            .connect_with(connect_options)
            .await?;

        info!("Database connection established");

        let db = Self { pool };

        // Run migrations
        db.run_migrations().await?;

        Ok(db)
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Run database migrations
    async fn run_migrations(&self) -> Result<(), DbError> {
        info!("Running database migrations...");

        // Read and execute the initial schema migration
        let migration_001 = include_str!("../../migrations/001_initial_schema.sql");
        sqlx::query(migration_001)
            .execute(&self.pool)
            .await
            .map_err(|e| DbError::Migration(e.to_string()))?;

        // 002: Theme system — add font columns and migrate theme values
        // Run each statement individually since SQLite doesn't support multi-statement ALTER TABLE
        let has_font_ui: bool = sqlx::query_scalar::<_, i32>(
            "SELECT COUNT(*) FROM pragma_table_info('settings') WHERE name = 'font_family_ui'"
        )
        .fetch_one(&self.pool)
        .await
        .map(|c| c > 0)
        .unwrap_or(false);

        if !has_font_ui {
            // Migrate old theme values
            sqlx::query("UPDATE settings SET theme = 'default-light' WHERE theme = 'light'")
                .execute(&self.pool).await.map_err(|e| DbError::Migration(e.to_string()))?;
            sqlx::query("UPDATE settings SET theme = 'default-dark' WHERE theme = 'dark'")
                .execute(&self.pool).await.map_err(|e| DbError::Migration(e.to_string()))?;

            sqlx::query("ALTER TABLE settings ADD COLUMN font_family_ui TEXT")
                .execute(&self.pool).await.map_err(|e| DbError::Migration(e.to_string()))?;
            sqlx::query("ALTER TABLE settings ADD COLUMN font_family_code TEXT")
                .execute(&self.pool).await.map_err(|e| DbError::Migration(e.to_string()))?;
        }

        info!("Database migrations completed");
        Ok(())
    }

    /// Get the default database path for the current platform
    pub fn default_path() -> PathBuf {
        let app_name = "com.labrat";

        #[cfg(target_os = "macos")]
        {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
                .join("Library/Application Support")
                .join(app_name)
                .join("data.db")
        }

        #[cfg(target_os = "linux")]
        {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
                .join(".local/share")
                .join(app_name)
                .join("data.db")
        }

        #[cfg(target_os = "windows")]
        {
            let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(appdata).join(app_name).join("data.db")
        }

        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            PathBuf::from("data.db")
        }
    }

    /// Close the database connection pool
    pub async fn close(&self) {
        self.pool.close().await;
        info!("Database connection closed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_database_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let db = Database::new(db_path.clone()).await.unwrap();

        // Verify the database file was created
        assert!(db_path.exists());

        // Verify we can query the settings table
        let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM settings")
            .fetch_one(db.pool())
            .await
            .unwrap();

        assert_eq!(result.0, 1); // Settings row should be initialized

        db.close().await;
    }
}
