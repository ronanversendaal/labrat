//! Anthropic API AI provider
//!
//! This module implements AI analysis using the Anthropic API directly.

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use super::provider::{AIError, AIProvider, AnalysisContext, RawSuggestion, build_analysis_prompt, parse_suggestions_response};

/// Anthropic API base URL
const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";

/// Default model to use
const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

/// Anthropic API provider
pub struct AnthropicProvider {
    id: String,
    name: String,
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl AnthropicProvider {
    /// Create a new Anthropic API provider
    pub fn new(id: String, name: String, api_key: String, model: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            id,
            name,
            api_key,
            model: model.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
            client,
        }
    }

    /// Build headers for Anthropic API requests
    fn build_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&self.api_key).expect("Invalid API key"),
        );
        headers.insert(
            "anthropic-version",
            HeaderValue::from_static("2023-06-01"),
        );
        headers
    }
}

/// Request body for Anthropic Messages API
#[derive(Debug, Serialize)]
struct MessagesRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: String,
}

/// Response from Anthropic Messages API
#[derive(Debug, Deserialize)]
struct MessagesResponse {
    content: Vec<ContentBlock>,
    #[allow(dead_code)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[allow(dead_code)]
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

/// Error response from Anthropic API
#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: ApiError,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: String,
    #[allow(dead_code)]
    #[serde(rename = "type")]
    error_type: String,
}

#[async_trait]
impl AIProvider for AnthropicProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    async fn check_availability(&self) -> Result<bool, AIError> {
        // Try a minimal API call to check if the key is valid
        let request = MessagesRequest {
            model: self.model.clone(),
            max_tokens: 10,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hi".to_string(),
            }],
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| AIError::RequestFailed(e.to_string()))?;

        match response.status().as_u16() {
            200 => Ok(true),
            401 => {
                warn!("Anthropic API key is invalid");
                Ok(false)
            }
            429 => {
                warn!("Anthropic API rate limited");
                Ok(true) // Key is valid, just rate limited
            }
            status => {
                warn!("Anthropic API returned status {}", status);
                Ok(false)
            }
        }
    }

    async fn analyze(&self, context: &AnalysisContext) -> Result<Vec<RawSuggestion>, AIError> {
        let prompt = build_analysis_prompt(context);

        info!("Starting Anthropic API analysis for MR {}", context.mr_id);
        debug!("Prompt length: {} characters, model: {}", prompt.len(), self.model);

        let request = MessagesRequest {
            model: self.model.clone(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt,
            }],
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| AIError::RequestFailed(e.to_string()))?;

        let status = response.status();

        if status == 401 {
            return Err(AIError::InvalidApiKey);
        }

        if status == 429 {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(60);
            return Err(AIError::RateLimited(retry_after));
        }

        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_default();
            if let Ok(error_response) = serde_json::from_str::<ErrorResponse>(&error_body) {
                return Err(AIError::RequestFailed(error_response.error.message));
            }
            return Err(AIError::RequestFailed(format!("Status {}: {}", status, error_body)));
        }

        let body = response.text().await
            .map_err(|e| AIError::RequestFailed(e.to_string()))?;

        let messages_response: MessagesResponse = serde_json::from_str(&body)
            .map_err(|e| AIError::ParseError(format!("Failed to parse response: {}", e)))?;

        // Extract text from response
        let response_text = messages_response
            .content
            .into_iter()
            .filter_map(|block| block.text)
            .collect::<Vec<_>>()
            .join("\n");

        debug!("Anthropic API response length: {} characters", response_text.len());

        // Parse the response
        let suggestions = parse_suggestions_response(&response_text)?;
        info!("Anthropic API analysis complete: {} suggestions", suggestions.len());

        Ok(suggestions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_headers() {
        let provider = AnthropicProvider::new(
            "test".to_string(),
            "Test".to_string(),
            "sk-test-key".to_string(),
            None,
        );

        let headers = provider.build_headers();
        assert!(headers.contains_key("x-api-key"));
        assert!(headers.contains_key("anthropic-version"));
    }
}
