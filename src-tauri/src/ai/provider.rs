//! AI provider trait definition
//!
//! This module defines the common interface for AI providers.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::types::{AISuggestion, SuggestionCategory, SuggestionSeverity};

/// Errors that can occur during AI analysis
#[derive(Debug, Error)]
pub enum AIError {
    #[error("Provider not configured: {0}")]
    NotConfigured(String),

    #[error("API request failed: {0}")]
    RequestFailed(String),

    #[error("Invalid API key")]
    InvalidApiKey,

    #[error("Rate limited, retry after {0} seconds")]
    RateLimited(u64),

    #[error("Analysis timeout after {0} seconds")]
    Timeout(u64),

    #[error("CLI not found: {0}")]
    CliNotFound(String),

    #[error("CLI execution failed: {0}")]
    CliExecutionFailed(String),

    #[error("Failed to parse response: {0}")]
    ParseError(String),

    #[error("Provider unavailable: {0}")]
    Unavailable(String),
}

/// Context for analyzing a diff
#[derive(Debug, Clone)]
pub struct AnalysisContext {
    pub mr_id: i64,
    pub mr_title: String,
    pub mr_description: Option<String>,
    pub files: Vec<FileContext>,
}

/// Context for a single file in the diff
#[derive(Debug, Clone)]
pub struct FileContext {
    pub path: String,
    pub old_path: Option<String>,
    pub diff: String,
    pub is_new: bool,
    pub is_deleted: bool,
    pub is_renamed: bool,
}

/// Raw suggestion from AI provider before processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawSuggestion {
    pub file_path: String,
    pub start_line: i32,
    pub end_line: i32,
    pub category: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub suggested_code: Option<String>,
    pub original_code: String,
}

impl RawSuggestion {
    /// Convert to AISuggestion with proper enum parsing
    pub fn to_suggestion(
        self,
        id: String,
        mr_id: i64,
        provider_id: String,
    ) -> AISuggestion {
        let category = match self.category.to_lowercase().as_str() {
            "code_quality" | "quality" => SuggestionCategory::CodeQuality,
            "potential_bug" | "bug" => SuggestionCategory::PotentialBug,
            "performance" | "perf" => SuggestionCategory::Performance,
            "security" | "sec" => SuggestionCategory::Security,
            "best_practice" | "best-practice" => SuggestionCategory::BestPractice,
            "readability" => SuggestionCategory::Readability,
            "documentation" | "docs" => SuggestionCategory::Documentation,
            _ => SuggestionCategory::CodeQuality,
        };

        let severity = match self.severity.to_lowercase().as_str() {
            "error" | "critical" | "high" => SuggestionSeverity::Error,
            "warning" | "warn" | "medium" => SuggestionSeverity::Warning,
            _ => SuggestionSeverity::Info,
        };

        AISuggestion {
            id,
            mr_id,
            provider_id,
            file_path: self.file_path,
            start_line: self.start_line,
            end_line: self.end_line,
            category,
            severity,
            title: self.title,
            description: self.description,
            suggested_code: self.suggested_code,
            original_code: self.original_code,
            status: super::types::SuggestionStatus::Pending,
            created_at: chrono::Utc::now(),
        }
    }
}

/// Common trait for all AI providers
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Get the provider's unique identifier
    fn id(&self) -> &str;

    /// Get the provider's display name
    fn name(&self) -> &str;

    /// Check if the provider is available and configured correctly
    async fn check_availability(&self) -> Result<bool, AIError>;

    /// Analyze a diff and return suggestions
    async fn analyze(&self, context: &AnalysisContext) -> Result<Vec<RawSuggestion>, AIError>;
}

/// Build the analysis prompt for AI providers
pub fn build_analysis_prompt(context: &AnalysisContext) -> String {
    let mut prompt = String::new();

    prompt.push_str("You are a senior code reviewer analyzing a merge request. ");
    prompt.push_str("Review the following diff and provide specific, actionable suggestions.\n\n");

    prompt.push_str(&format!("## Merge Request: {}\n\n", context.mr_title));

    if let Some(desc) = &context.mr_description {
        if !desc.is_empty() {
            prompt.push_str(&format!("### Description:\n{}\n\n", desc));
        }
    }

    prompt.push_str("### Changed Files:\n\n");

    for file in &context.files {
        if file.is_deleted {
            prompt.push_str(&format!("#### {} (deleted)\n", file.path));
            continue;
        }

        let header = if file.is_new {
            format!("#### {} (new file)\n", file.path)
        } else if file.is_renamed {
            format!(
                "#### {} (renamed from {})\n",
                file.path,
                file.old_path.as_deref().unwrap_or("unknown")
            )
        } else {
            format!("#### {}\n", file.path)
        };

        prompt.push_str(&header);
        prompt.push_str("```diff\n");
        prompt.push_str(&file.diff);
        if !file.diff.ends_with('\n') {
            prompt.push('\n');
        }
        prompt.push_str("```\n\n");
    }

    prompt.push_str(r#"
### Instructions:

Analyze the diff above and provide suggestions in the following JSON format:

```json
{
  "suggestions": [
    {
      "file_path": "path/to/file.ts",
      "start_line": 10,
      "end_line": 15,
      "category": "potential_bug|performance|security|code_quality|best_practice|readability|documentation",
      "severity": "error|warning|info",
      "title": "Brief title of the issue",
      "description": "Detailed explanation of the issue and why it matters",
      "suggested_code": "Optional: the suggested replacement code",
      "original_code": "The original code being referenced"
    }
  ]
}
```

Focus on:
1. Potential bugs or logic errors
2. Security vulnerabilities
3. Performance issues
4. Code quality and maintainability
5. Best practices violations

Be specific about line numbers (use the new file line numbers from the diff).
Only suggest changes for code that was actually modified (lines with + prefix).
Do not suggest trivial style changes unless they significantly impact readability.
"#);

    prompt
}

/// Parse AI response to extract suggestions
pub fn parse_suggestions_response(response: &str) -> Result<Vec<RawSuggestion>, AIError> {
    // Try to find JSON in the response
    let json_str = extract_json_from_response(response)?;

    // Parse the JSON
    let parsed: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| AIError::ParseError(format!("Invalid JSON: {}", e)))?;

    // Extract suggestions array
    let suggestions_value = parsed
        .get("suggestions")
        .ok_or_else(|| AIError::ParseError("Missing 'suggestions' field".to_string()))?;

    let suggestions: Vec<RawSuggestion> = serde_json::from_value(suggestions_value.clone())
        .map_err(|e| AIError::ParseError(format!("Invalid suggestions format: {}", e)))?;

    Ok(suggestions)
}

/// Extract JSON from a response that might contain markdown code blocks
fn extract_json_from_response(response: &str) -> Result<String, AIError> {
    // Try to find JSON in code block
    if let Some(start) = response.find("```json") {
        let after_marker = &response[start + 7..];
        if let Some(end) = after_marker.find("```") {
            return Ok(after_marker[..end].trim().to_string());
        }
    }

    // Try to find plain code block
    if let Some(start) = response.find("```\n{") {
        let after_marker = &response[start + 4..];
        if let Some(end) = after_marker.find("```") {
            return Ok(after_marker[..end].trim().to_string());
        }
    }

    // Try to find raw JSON object
    if let Some(start) = response.find('{') {
        if let Some(end) = response.rfind('}') {
            return Ok(response[start..=end].to_string());
        }
    }

    Err(AIError::ParseError("No JSON found in response".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_from_code_block() {
        let response = r#"Here is my analysis:

```json
{
  "suggestions": []
}
```

That's all!"#;

        let json = extract_json_from_response(response).unwrap();
        assert!(json.contains("suggestions"));
    }

    #[test]
    fn test_extract_raw_json() {
        let response = r#"{"suggestions": [{"file_path": "test.rs", "start_line": 1, "end_line": 1, "category": "bug", "severity": "error", "title": "Test", "description": "Desc", "suggested_code": null, "original_code": "x"}]}"#;

        let json = extract_json_from_response(response).unwrap();
        let suggestions = parse_suggestions_response(&json).unwrap();
        assert_eq!(suggestions.len(), 1);
    }

    #[test]
    fn test_raw_suggestion_conversion() {
        let raw = RawSuggestion {
            file_path: "test.rs".to_string(),
            start_line: 10,
            end_line: 15,
            category: "potential_bug".to_string(),
            severity: "warning".to_string(),
            title: "Test issue".to_string(),
            description: "Description".to_string(),
            suggested_code: Some("new code".to_string()),
            original_code: "old code".to_string(),
        };

        let suggestion = raw.to_suggestion("id1".to_string(), 123, "provider1".to_string());

        assert_eq!(suggestion.category, SuggestionCategory::PotentialBug);
        assert_eq!(suggestion.severity, SuggestionSeverity::Warning);
    }
}
