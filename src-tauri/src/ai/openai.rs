//! OpenAI API AI provider
//!
//! This module implements AI analysis using the OpenAI API.

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use super::provider::{AIError, AIProvider, AnalysisContext, RawSuggestion, build_analysis_prompt, parse_suggestions_response};

/// OpenAI API base URL
const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

/// Default model to use
const DEFAULT_MODEL: &str = "gpt-4o";

/// OpenAI API provider
pub struct OpenAIProvider {
    id: String,
    name: String,
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl OpenAIProvider {
    /// Create a new OpenAI API provider
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

    /// Build headers for OpenAI API requests
    fn build_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.api_key)).expect("Invalid API key"),
        );
        headers
    }
}

/// Request body for OpenAI Chat Completions API
#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

/// Response from OpenAI Chat Completions API
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: Option<String>,
}

/// Error response from OpenAI API
#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: ApiError,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: String,
    #[allow(dead_code)]
    #[serde(rename = "type")]
    error_type: Option<String>,
}

#[async_trait]
impl AIProvider for OpenAIProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    async fn check_availability(&self) -> Result<bool, AIError> {
        // Try a minimal API call to check if the key is valid
        let request = ChatCompletionRequest {
            model: self.model.clone(),
            max_tokens: 10,
            temperature: 0.0,
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hi".to_string(),
            }],
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| AIError::RequestFailed(e.to_string()))?;

        match response.status().as_u16() {
            200 => Ok(true),
            401 => {
                warn!("OpenAI API key is invalid");
                Ok(false)
            }
            429 => {
                warn!("OpenAI API rate limited");
                Ok(true) // Key is valid, just rate limited
            }
            status => {
                warn!("OpenAI API returned status {}", status);
                Ok(false)
            }
        }
    }

    async fn analyze(&self, context: &AnalysisContext) -> Result<Vec<RawSuggestion>, AIError> {
        let prompt = build_analysis_prompt(context);

        info!("Starting OpenAI API analysis for MR {}", context.mr_id);
        debug!("Prompt length: {} characters, model: {}", prompt.len(), self.model);

        let request = ChatCompletionRequest {
            model: self.model.clone(),
            max_tokens: 4096,
            temperature: 0.1, // Low temperature for consistent output
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a senior code reviewer. Analyze code changes and provide actionable suggestions in JSON format.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
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

        let chat_response: ChatCompletionResponse = serde_json::from_str(&body)
            .map_err(|e| AIError::ParseError(format!("Failed to parse response: {}", e)))?;

        // Extract text from response
        let response_text = chat_response
            .choices
            .into_iter()
            .filter_map(|choice| choice.message.content)
            .collect::<Vec<_>>()
            .join("\n");

        debug!("OpenAI API response length: {} characters", response_text.len());

        // Parse the response
        let suggestions = parse_suggestions_response(&response_text)?;
        info!("OpenAI API analysis complete: {} suggestions", suggestions.len());

        Ok(suggestions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_headers() {
        let provider = OpenAIProvider::new(
            "test".to_string(),
            "Test".to_string(),
            "sk-test-key".to_string(),
            None,
        );

        let headers = provider.build_headers();
        assert!(headers.contains_key(AUTHORIZATION));
    }
}
