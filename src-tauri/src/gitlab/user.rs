//! GitLab User API endpoints
//!
//! This module provides wrappers for user-related GitLab API endpoints.

use serde::{Deserialize, Serialize};

use super::client::{GitLabClient, GitLabClientError};

/// Current user information returned by GET /user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub web_url: String,
    pub state: String,
    pub is_admin: Option<bool>,
}

/// Personal access token information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalAccessToken {
    pub id: i64,
    pub name: String,
    pub revoked: bool,
    pub created_at: String,
    pub scopes: Vec<String>,
    pub user_id: i64,
    pub last_used_at: Option<String>,
    pub active: bool,
    pub expires_at: Option<String>,
}

impl GitLabClient {
    /// Get the current authenticated user
    ///
    /// GET /user
    pub async fn get_current_user(&self) -> Result<CurrentUser, GitLabClientError> {
        self.get("/user").await
    }

    /// Get information about the current personal access token
    ///
    /// GET /personal_access_tokens/self
    pub async fn get_current_token(&self) -> Result<PersonalAccessToken, GitLabClientError> {
        self.get("/personal_access_tokens/self").await
    }

    /// Validate the current token and return user info + scopes
    pub async fn validate_token(
        &self,
    ) -> Result<(CurrentUser, Vec<String>), GitLabClientError> {
        // Get user info
        let user = self.get_current_user().await?;

        // Get token info for scopes
        let token = self.get_current_token().await?;

        Ok((user, token.scopes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_current_user_deserialize() {
        let json = r#"{
            "id": 1,
            "username": "john_smith",
            "name": "John Smith",
            "email": "john@example.com",
            "avatar_url": "https://example.com/avatar.png",
            "web_url": "https://gitlab.com/john_smith",
            "state": "active",
            "is_admin": false
        }"#;

        let user: CurrentUser = serde_json::from_str(json).unwrap();
        assert_eq!(user.id, 1);
        assert_eq!(user.username, "john_smith");
    }
}
