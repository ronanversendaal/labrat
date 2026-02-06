//! Secure credential storage using OS keychain
//!
//! This module provides secure storage for sensitive data like
//! GitLab access tokens and AI provider API keys using the
//! platform's native keychain/credential manager.
//!
//! An in-memory cache avoids repeated keychain access prompts
//! on macOS. Tokens are read from the keychain once per session
//! and cached in memory for subsequent accesses.

use keyring::Entry;
use std::collections::HashMap;
use std::sync::RwLock;
use thiserror::Error;
use tracing::{debug, warn};

/// Service name used for keyring entries
const SERVICE_NAME: &str = "com.labrat";

/// Credential storage errors
#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("Failed to access keyring: {0}")]
    KeyringAccess(String),

    #[error("Credential not found for: {0}")]
    NotFound(String),

    #[error("Failed to store credential: {0}")]
    StoreFailed(String),

    #[error("Failed to delete credential: {0}")]
    DeleteFailed(String),
}

/// Credential types that can be stored
#[derive(Debug, Clone, Copy)]
pub enum CredentialType {
    /// GitLab personal access token
    GitLabToken,
    /// AI provider API key
    AiApiKey,
}

impl CredentialType {
    /// Get the prefix used for keyring entry names
    fn prefix(&self) -> &'static str {
        match self {
            CredentialType::GitLabToken => "gitlab-token",
            CredentialType::AiApiKey => "ai-apikey",
        }
    }
}

/// Secure credential storage manager
pub struct CredentialStore;

impl CredentialStore {
    /// Create a new credential store instance
    pub fn new() -> Self {
        Self
    }

    /// Store a credential securely
    ///
    /// # Arguments
    /// * `credential_type` - The type of credential being stored
    /// * `account_id` - Unique identifier for the account (e.g., GitLab account ID)
    /// * `secret` - The secret value to store (e.g., access token)
    pub fn store(
        &self,
        credential_type: CredentialType,
        account_id: &str,
        secret: &str,
    ) -> Result<(), CredentialError> {
        let entry_name = self.entry_name(credential_type, account_id);
        debug!("Storing credential: {} (service: {})", entry_name, SERVICE_NAME);

        let entry = match Entry::new(SERVICE_NAME, &entry_name) {
            Ok(e) => {
                debug!("Keyring entry created successfully");
                e
            }
            Err(e) => {
                warn!("Failed to create keyring entry: {:?}", e);
                return Err(CredentialError::KeyringAccess(e.to_string()));
            }
        };

        match entry.set_password(secret) {
            Ok(()) => {
                debug!("Password set successfully in keyring");
                Ok(())
            }
            Err(e) => {
                warn!("Failed to set password in keyring: {:?}", e);
                Err(CredentialError::StoreFailed(e.to_string()))
            }
        }
    }

    /// Retrieve a credential
    ///
    /// # Arguments
    /// * `credential_type` - The type of credential to retrieve
    /// * `account_id` - Unique identifier for the account
    ///
    /// # Returns
    /// The secret value if found, or an error
    pub fn get(
        &self,
        credential_type: CredentialType,
        account_id: &str,
    ) -> Result<String, CredentialError> {
        let entry_name = self.entry_name(credential_type, account_id);
        debug!("Retrieving credential: {}", entry_name);

        let entry = Entry::new(SERVICE_NAME, &entry_name)
            .map_err(|e| CredentialError::KeyringAccess(e.to_string()))?;

        match entry.get_password() {
            Ok(secret) => {
                debug!("Credential retrieved successfully");
                Ok(secret)
            }
            Err(keyring::Error::NoEntry) => {
                warn!("Credential not found: {}", entry_name);
                Err(CredentialError::NotFound(entry_name))
            }
            Err(e) => Err(CredentialError::KeyringAccess(e.to_string())),
        }
    }

    /// Delete a credential
    ///
    /// # Arguments
    /// * `credential_type` - The type of credential to delete
    /// * `account_id` - Unique identifier for the account
    pub fn delete(
        &self,
        credential_type: CredentialType,
        account_id: &str,
    ) -> Result<(), CredentialError> {
        let entry_name = self.entry_name(credential_type, account_id);
        debug!("Deleting credential: {}", entry_name);

        let entry = Entry::new(SERVICE_NAME, &entry_name)
            .map_err(|e| CredentialError::KeyringAccess(e.to_string()))?;

        match entry.delete_credential() {
            Ok(()) => {
                debug!("Credential deleted successfully");
                Ok(())
            }
            Err(keyring::Error::NoEntry) => {
                // Already deleted, not an error
                debug!("Credential was already deleted");
                Ok(())
            }
            Err(e) => Err(CredentialError::DeleteFailed(e.to_string())),
        }
    }

    /// Check if a credential exists
    ///
    /// # Arguments
    /// * `credential_type` - The type of credential to check
    /// * `account_id` - Unique identifier for the account
    pub fn exists(&self, credential_type: CredentialType, account_id: &str) -> bool {
        self.get(credential_type, account_id).is_ok()
    }

    /// Generate the keyring entry name for a credential
    fn entry_name(&self, credential_type: CredentialType, account_id: &str) -> String {
        format!("{}-{}", credential_type.prefix(), account_id)
    }
}

impl Default for CredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience functions for managing GitLab tokens
pub struct CredentialManager;

impl CredentialManager {
    /// Check if secure storage (keyring) is available on this system
    /// Returns Ok(true) if available, Ok(false) if not, or an error if check failed
    pub fn is_secure_storage_available() -> Result<bool, CredentialError> {
        // Try to create a test entry to verify keyring access
        let test_name = "storage-check-test";
        let entry = Entry::new(SERVICE_NAME, test_name)
            .map_err(|e| CredentialError::KeyringAccess(e.to_string()))?;

        // Try to store and immediately delete a test value
        match entry.set_password("test") {
            Ok(()) => {
                // Storage works, clean up
                let _ = entry.delete_credential();
                Ok(true)
            }
            Err(e) => {
                warn!("Secure storage check failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Store a GitLab token for an account
    pub fn store_token(account_id: &str, token: &str) -> Result<(), CredentialError> {
        CredentialStore::new().store(CredentialType::GitLabToken, account_id, token)
    }

    /// Get a GitLab token for an account
    pub fn get_token(account_id: &str) -> Result<Option<String>, CredentialError> {
        match CredentialStore::new().get(CredentialType::GitLabToken, account_id) {
            Ok(token) => Ok(Some(token)),
            Err(CredentialError::NotFound(_)) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a GitLab token for an account
    pub fn delete_token(account_id: &str) -> Result<(), CredentialError> {
        CredentialStore::new().delete(CredentialType::GitLabToken, account_id)
    }

    /// Store an AI API key for a provider
    pub fn store_ai_key(provider_id: &str, api_key: &str) -> Result<(), CredentialError> {
        CredentialStore::new().store(CredentialType::AiApiKey, provider_id, api_key)
    }

    /// Get an AI API key for a provider
    pub fn get_ai_key(provider_id: &str) -> Result<Option<String>, CredentialError> {
        match CredentialStore::new().get(CredentialType::AiApiKey, provider_id) {
            Ok(key) => Ok(Some(key)),
            Err(CredentialError::NotFound(_)) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete an AI API key for a provider
    pub fn delete_ai_key(provider_id: &str) -> Result<(), CredentialError> {
        CredentialStore::new().delete(CredentialType::AiApiKey, provider_id)
    }
}

/// In-memory credential cache to avoid repeated OS keychain prompts.
///
/// On macOS, each keychain access can trigger a password dialog, especially
/// for unsigned development builds. This cache reads from the keychain once
/// and serves subsequent requests from memory.
///
/// The cache is cleared when the app exits (nothing persisted to disk).
pub struct CredentialCache {
    cache: RwLock<HashMap<String, String>>,
}

impl CredentialCache {
    /// Create a new empty credential cache
    pub fn new() -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
        }
    }

    /// Build the cache key for a credential type + account
    fn cache_key(credential_type: CredentialType, account_id: &str) -> String {
        format!("{}-{}", credential_type.prefix(), account_id)
    }

    /// Get a GitLab token, checking cache first then falling back to keychain.
    /// On a keychain hit, the value is cached for future calls.
    pub fn get_token(&self, account_id: &str) -> Result<Option<String>, CredentialError> {
        self.get_cached(CredentialType::GitLabToken, account_id)
    }

    /// Get an AI API key, checking cache first then falling back to keychain.
    pub fn get_ai_key(&self, provider_id: &str) -> Result<Option<String>, CredentialError> {
        self.get_cached(CredentialType::AiApiKey, provider_id)
    }

    /// Store a GitLab token in both keychain and cache.
    pub fn store_token(&self, account_id: &str, token: &str) -> Result<(), CredentialError> {
        CredentialManager::store_token(account_id, token)?;
        self.insert(CredentialType::GitLabToken, account_id, token);
        Ok(())
    }

    /// Store an AI API key in both keychain and cache.
    pub fn store_ai_key(&self, provider_id: &str, api_key: &str) -> Result<(), CredentialError> {
        CredentialManager::store_ai_key(provider_id, api_key)?;
        self.insert(CredentialType::AiApiKey, provider_id, api_key);
        Ok(())
    }

    /// Delete a GitLab token from both keychain and cache.
    pub fn delete_token(&self, account_id: &str) -> Result<(), CredentialError> {
        self.remove(CredentialType::GitLabToken, account_id);
        CredentialManager::delete_token(account_id)
    }

    /// Delete an AI API key from both keychain and cache.
    pub fn delete_ai_key(&self, provider_id: &str) -> Result<(), CredentialError> {
        self.remove(CredentialType::AiApiKey, provider_id);
        CredentialManager::delete_ai_key(provider_id)
    }

    /// Get a credential, checking cache first then keychain.
    fn get_cached(
        &self,
        credential_type: CredentialType,
        account_id: &str,
    ) -> Result<Option<String>, CredentialError> {
        let key = Self::cache_key(credential_type, account_id);

        // Check cache first (read lock — fast, non-blocking)
        {
            let cache = self.cache.read().unwrap();
            if let Some(value) = cache.get(&key) {
                debug!("Credential cache hit: {}", key);
                return Ok(Some(value.clone()));
            }
        }

        // Cache miss — read from keychain
        debug!("Credential cache miss: {}, reading from keychain", key);
        let result = match credential_type {
            CredentialType::GitLabToken => CredentialManager::get_token(account_id),
            CredentialType::AiApiKey => CredentialManager::get_ai_key(account_id),
        }?;

        // Populate cache on successful keychain read
        if let Some(ref value) = result {
            let mut cache = self.cache.write().unwrap();
            cache.insert(key, value.clone());
        }

        Ok(result)
    }

    /// Insert a value directly into the cache.
    fn insert(&self, credential_type: CredentialType, account_id: &str, value: &str) {
        let key = Self::cache_key(credential_type, account_id);
        let mut cache = self.cache.write().unwrap();
        cache.insert(key, value.to_string());
    }

    /// Remove a value from the cache.
    fn remove(&self, credential_type: CredentialType, account_id: &str) {
        let key = Self::cache_key(credential_type, account_id);
        let mut cache = self.cache.write().unwrap();
        cache.remove(&key);
    }
}

impl Default for CredentialCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests interact with the real system keychain
    // They are marked as ignored by default to avoid polluting the keychain
    // Run with: cargo test -- --ignored

    #[test]
    #[ignore]
    fn test_credential_store_lifecycle() {
        let store = CredentialStore::new();
        let account_id = "test-account-123";
        let token = "glpat-xxxx-test-token";

        // Store
        store
            .store(CredentialType::GitLabToken, account_id, token)
            .unwrap();

        // Verify exists
        assert!(store.exists(CredentialType::GitLabToken, account_id));

        // Retrieve
        let retrieved = store.get(CredentialType::GitLabToken, account_id).unwrap();
        assert_eq!(retrieved, token);

        // Delete
        store
            .delete(CredentialType::GitLabToken, account_id)
            .unwrap();

        // Verify deleted
        assert!(!store.exists(CredentialType::GitLabToken, account_id));
    }

    #[test]
    fn test_entry_name_generation() {
        let store = CredentialStore::new();
        assert_eq!(
            store.entry_name(CredentialType::GitLabToken, "abc123"),
            "gitlab-token-abc123"
        );
        assert_eq!(
            store.entry_name(CredentialType::AiApiKey, "provider1"),
            "ai-apikey-provider1"
        );
    }
}
