//! AI provider and suggestion types
//!
//! This module defines types for AI providers and their suggestions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// AI provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AIProviderType {
    ClaudeCli,
    AnthropicApi,
    OpenaiApi,
}

impl std::fmt::Display for AIProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIProviderType::ClaudeCli => write!(f, "claude_cli"),
            AIProviderType::AnthropicApi => write!(f, "anthropic_api"),
            AIProviderType::OpenaiApi => write!(f, "openai_api"),
        }
    }
}

/// An AI provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProvider {
    pub id: String,
    pub account_id: Option<String>,
    pub provider_type: AIProviderType,
    pub name: String,
    pub model: Option<String>,
    pub is_default: bool,
    pub enabled: bool,
    #[serde(default)]
    pub is_available: bool,
    pub created_at: DateTime<Utc>,
}

/// Suggestion category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionCategory {
    CodeQuality,
    PotentialBug,
    Performance,
    Security,
    BestPractice,
    Readability,
    Documentation,
}

impl std::fmt::Display for SuggestionCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SuggestionCategory::CodeQuality => write!(f, "code_quality"),
            SuggestionCategory::PotentialBug => write!(f, "potential_bug"),
            SuggestionCategory::Performance => write!(f, "performance"),
            SuggestionCategory::Security => write!(f, "security"),
            SuggestionCategory::BestPractice => write!(f, "best_practice"),
            SuggestionCategory::Readability => write!(f, "readability"),
            SuggestionCategory::Documentation => write!(f, "documentation"),
        }
    }
}

/// Suggestion severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SuggestionSeverity {
    Info,
    Warning,
    Error,
}

impl std::fmt::Display for SuggestionSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SuggestionSeverity::Info => write!(f, "info"),
            SuggestionSeverity::Warning => write!(f, "warning"),
            SuggestionSeverity::Error => write!(f, "error"),
        }
    }
}

/// Suggestion status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SuggestionStatus {
    Pending,
    Accepted,
    Dismissed,
    Posted,
}

impl std::fmt::Display for SuggestionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SuggestionStatus::Pending => write!(f, "pending"),
            SuggestionStatus::Accepted => write!(f, "accepted"),
            SuggestionStatus::Dismissed => write!(f, "dismissed"),
            SuggestionStatus::Posted => write!(f, "posted"),
        }
    }
}

/// An AI suggestion for code review
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISuggestion {
    pub id: String,
    pub mr_id: i64,
    pub provider_id: String,
    pub file_path: String,
    pub start_line: i32,
    pub end_line: i32,
    pub category: SuggestionCategory,
    pub severity: SuggestionSeverity,
    pub title: String,
    pub description: String,
    pub suggested_code: Option<String>,
    pub original_code: String,
    pub status: SuggestionStatus,
    pub created_at: DateTime<Utc>,
}

/// Request to add an AI provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddProviderRequest {
    pub provider_type: AIProviderType,
    pub name: String,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub cli_path: Option<String>,
}

/// Request to analyze a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeDiffRequest {
    pub project_id: i64,
    pub mr_iid: i64,
    pub provider_id: Option<String>,
}

/// Response from analyzing a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeDiffResponse {
    pub suggestions: Vec<AISuggestion>,
    pub provider_used: String,
    pub analysis_time_ms: u64,
}

/// Progress event during analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisProgressEvent {
    pub mr_id: i64,
    pub status: AnalysisStatus,
    pub progress: u8,
    pub message: String,
}

/// Analysis status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnalysisStatus {
    Started,
    Processing,
    Completed,
    Error,
}

/// Request to update suggestion status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSuggestionRequest {
    pub suggestion_id: String,
    pub status: SuggestionStatus,
}

/// Response from checking CLI availability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliAvailableResponse {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}
