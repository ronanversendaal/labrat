//! GitLab HTTP client wrapper
//!
//! This module provides a wrapper around reqwest for making
//! authenticated requests to the GitLab API with proper
//! error handling, rate limiting, and retry logic.

use reqwest::{header, Client, Response, StatusCode};
use serde::de::DeserializeOwned;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, warn};

/// Default timeout for API requests
const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Maximum number of retries for transient errors
const MAX_RETRIES: u32 = 3;

/// Base delay between retries (will be exponentially increased)
const RETRY_BASE_DELAY_MS: u64 = 500;

/// GitLab API client errors
#[derive(Debug, Error)]
pub enum GitLabClientError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("GitLab API error ({status}): {message}")]
    ApiError { status: u16, message: String },

    #[error("Rate limited. Retry after {retry_after} seconds")]
    RateLimited { retry_after: u64 },

    #[error("Authentication failed")]
    Unauthorized,

    #[error("Resource not found")]
    NotFound,

    #[error("Forbidden: insufficient permissions")]
    Forbidden,

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
}

/// GitLab API client
pub struct GitLabClient {
    client: Client,
    base_url: String,
    access_token: String,
}

impl GitLabClient {
    /// Create a new GitLab API client
    pub fn new(instance_url: &str, access_token: &str) -> Result<Self, GitLabClientError> {
        // Normalize the base URL
        let base_url = instance_url.trim_end_matches('/');

        // Validate URL format
        if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
            return Err(GitLabClientError::InvalidUrl(
                "URL must start with http:// or https://".to_string(),
            ));
        }

        let client = Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .build()
            .map_err(GitLabClientError::RequestFailed)?;

        Ok(Self {
            client,
            base_url: format!("{}/api/v4", base_url),
            access_token: access_token.to_string(),
        })
    }

    /// Get the base URL of this client
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Make a GET request to the GitLab API
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, GitLabClientError> {
        let url = format!("{}{}", self.base_url, path);
        debug!("GET {}", url);

        let response = self.execute_with_retry(|| async {
            self.client
                .get(&url)
                .header(header::AUTHORIZATION, format!("Bearer {}", self.access_token))
                .header(header::ACCEPT, "application/json")
                .send()
                .await
        })
        .await?;

        self.handle_response(response).await
    }

    /// Make a POST request to the GitLab API
    pub async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, GitLabClientError> {
        let url = format!("{}{}", self.base_url, path);
        debug!("POST {}", url);

        let response = self.execute_with_retry(|| async {
            self.client
                .post(&url)
                .header(header::AUTHORIZATION, format!("Bearer {}", self.access_token))
                .header(header::ACCEPT, "application/json")
                .header(header::CONTENT_TYPE, "application/json")
                .json(body)
                .send()
                .await
        })
        .await?;

        self.handle_response(response).await
    }

    /// Make a PUT request to the GitLab API
    pub async fn put<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, GitLabClientError> {
        let url = format!("{}{}", self.base_url, path);
        debug!("PUT {}", url);

        let response = self.execute_with_retry(|| async {
            self.client
                .put(&url)
                .header(header::AUTHORIZATION, format!("Bearer {}", self.access_token))
                .header(header::ACCEPT, "application/json")
                .header(header::CONTENT_TYPE, "application/json")
                .json(body)
                .send()
                .await
        })
        .await?;

        self.handle_response(response).await
    }

    /// Execute a request with exponential backoff retry for transient errors
    async fn execute_with_retry<F, Fut>(&self, make_request: F) -> Result<Response, GitLabClientError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<Response, reqwest::Error>>,
    {
        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            match make_request().await {
                Ok(response) => {
                    let status = response.status();

                    // Check for rate limiting
                    if status == StatusCode::TOO_MANY_REQUESTS {
                        let retry_after = self.get_retry_after(&response);
                        warn!("Rate limited, retry after {} seconds", retry_after);
                        return Err(GitLabClientError::RateLimited { retry_after });
                    }

                    // For server errors, retry
                    if status.is_server_error() && attempt < MAX_RETRIES - 1 {
                        let delay = RETRY_BASE_DELAY_MS * 2u64.pow(attempt);
                        warn!(
                            "Server error ({}), retrying in {}ms (attempt {}/{})",
                            status, delay, attempt + 1, MAX_RETRIES
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                        continue;
                    }

                    return Ok(response);
                }
                Err(e) => {
                    // For connection errors, retry
                    if e.is_connect() || e.is_timeout() {
                        if attempt < MAX_RETRIES - 1 {
                            let delay = RETRY_BASE_DELAY_MS * 2u64.pow(attempt);
                            warn!(
                                "Connection error: {}, retrying in {}ms (attempt {}/{})",
                                e, delay, attempt + 1, MAX_RETRIES
                            );
                            tokio::time::sleep(Duration::from_millis(delay)).await;
                            last_error = Some(e);
                            continue;
                        }
                    }
                    return Err(GitLabClientError::RequestFailed(e));
                }
            }
        }

        // If we exhausted retries, return the last error
        Err(GitLabClientError::RequestFailed(
            last_error.expect("Should have an error after retries"),
        ))
    }

    /// Handle the API response, converting to our error types
    async fn handle_response<T: DeserializeOwned>(
        &self,
        response: Response,
    ) -> Result<T, GitLabClientError> {
        let status = response.status();

        match status {
            StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED => {
                let body = response.text().await?;
                serde_json::from_str(&body).map_err(GitLabClientError::JsonError)
            }
            StatusCode::NO_CONTENT => {
                // For 204 responses, try to return a default/unit type
                serde_json::from_str("null").map_err(GitLabClientError::JsonError)
            }
            StatusCode::UNAUTHORIZED => Err(GitLabClientError::Unauthorized),
            StatusCode::FORBIDDEN => Err(GitLabClientError::Forbidden),
            StatusCode::NOT_FOUND => Err(GitLabClientError::NotFound),
            StatusCode::TOO_MANY_REQUESTS => {
                let retry_after = self.get_retry_after(&response);
                Err(GitLabClientError::RateLimited { retry_after })
            }
            _ => {
                let body = response.text().await.unwrap_or_default();
                let message = self.extract_error_message(&body);
                Err(GitLabClientError::ApiError {
                    status: status.as_u16(),
                    message,
                })
            }
        }
    }

    /// Extract retry-after header value
    fn get_retry_after(&self, response: &Response) -> u64 {
        response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(60) // Default to 60 seconds
    }

    /// Extract error message from response body
    fn extract_error_message(&self, body: &str) -> String {
        // Try to parse as JSON and extract message
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(message) = json.get("message").or(json.get("error")) {
                return message.to_string();
            }
        }
        // Fall back to raw body
        body.to_string()
    }

    /// Make a paginated GET request, returning all pages
    pub async fn get_all_pages<T: DeserializeOwned + Clone>(
        &self,
        path: &str,
        per_page: u32,
    ) -> Result<Vec<T>, GitLabClientError> {
        let mut all_items = Vec::new();
        let mut page = 1;

        loop {
            let separator = if path.contains('?') { '&' } else { '?' };
            let paginated_path = format!("{}{}per_page={}&page={}", path, separator, per_page, page);

            let items: Vec<T> = self.get(&paginated_path).await?;

            if items.is_empty() {
                break;
            }

            let count = items.len();
            all_items.extend(items);

            // If we got fewer items than requested, we're done
            if count < per_page as usize {
                break;
            }

            page += 1;
        }

        Ok(all_items)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_normalization() {
        let client = GitLabClient::new("https://gitlab.com/", "token").unwrap();
        assert_eq!(client.base_url(), "https://gitlab.com/api/v4");

        let client = GitLabClient::new("https://gitlab.com", "token").unwrap();
        assert_eq!(client.base_url(), "https://gitlab.com/api/v4");
    }

    #[test]
    fn test_invalid_url() {
        let result = GitLabClient::new("gitlab.com", "token");
        assert!(result.is_err());
    }
}
