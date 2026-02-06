//! Generic CLI binary AI provider
//!
//! This module implements a unified CLI provider that supports
//! multiple AI CLI binaries (Claude, OpenCode, Ollama, llm, Gemini, Custom).

use async_trait::async_trait;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing::{debug, info, warn};

use super::provider::{AIError, AIProvider as AIProviderTrait, AnalysisContext, RawSuggestion, build_analysis_prompt, parse_suggestions_response};
use super::types::{AIProviderType, AvailableModel, CliCheckResponse, ModelsResponse, ValidateCliPathResponse};

/// Configuration for a specific CLI binary
pub struct CliBinaryConfig {
    /// Default command names to try (in order)
    pub command_names: Vec<&'static str>,
    /// Argument to get version
    pub version_arg: &'static str,
    /// How to invoke for analysis: args before prompt
    pub invoke_args: Vec<&'static str>,
    /// Flag for model selection (e.g., "--model")
    pub model_flag: Option<&'static str>,
    /// Whether the model is a positional arg (Ollama: `ollama run <model>`)
    pub model_positional: bool,
    /// Whether to send prompt via stdin
    pub prompt_via_stdin: bool,
    /// Command + args to list models (e.g., ["ollama", "list"])
    pub list_models_cmd: Option<Vec<&'static str>>,
    /// Display label
    pub label: &'static str,
}

/// Get binary configuration for a provider type
pub fn get_binary_config(provider_type: AIProviderType) -> Option<CliBinaryConfig> {
    match provider_type {
        AIProviderType::ClaudeCli => Some(CliBinaryConfig {
            command_names: vec!["claude", "claude-cli"],
            version_arg: "--version",
            invoke_args: vec!["--print"],
            model_flag: Some("--model"),
            model_positional: false,
            prompt_via_stdin: true,
            list_models_cmd: None, // Hardcoded fallback + optional API fetch
            label: "Claude CLI",
        }),
        AIProviderType::OpencodeCli => Some(CliBinaryConfig {
            command_names: vec!["opencode"],
            version_arg: "--version",
            invoke_args: vec!["run"],
            model_flag: Some("--model"),
            model_positional: false,
            prompt_via_stdin: true,
            list_models_cmd: Some(vec!["opencode", "models"]),
            label: "OpenCode",
        }),
        AIProviderType::OllamaCli => Some(CliBinaryConfig {
            command_names: vec!["ollama"],
            version_arg: "--version",
            invoke_args: vec!["run"],
            model_flag: None, // Model is positional
            model_positional: true,
            prompt_via_stdin: true,
            list_models_cmd: Some(vec!["ollama", "list"]),
            label: "Ollama",
        }),
        AIProviderType::LlmCli => Some(CliBinaryConfig {
            command_names: vec!["llm"],
            version_arg: "--version",
            invoke_args: vec![],
            model_flag: Some("-m"),
            model_positional: false,
            prompt_via_stdin: true,
            list_models_cmd: Some(vec!["llm", "models"]),
            label: "llm",
        }),
        AIProviderType::GeminiCli => Some(CliBinaryConfig {
            command_names: vec!["gemini"],
            version_arg: "--version",
            invoke_args: vec![],
            model_flag: Some("--model"),
            model_positional: false,
            prompt_via_stdin: true,
            list_models_cmd: None, // Hardcoded list
            label: "Gemini CLI",
        }),
        AIProviderType::CustomCli => Some(CliBinaryConfig {
            command_names: vec![], // User must provide path
            version_arg: "--version",
            invoke_args: vec![],
            model_flag: None,
            model_positional: false,
            prompt_via_stdin: true,
            list_models_cmd: None,
            label: "Custom CLI",
        }),
        _ => None, // API providers don't use this
    }
}

/// Generic CLI provider that works with any supported binary
pub struct CliProvider {
    id: String,
    name: String,
    provider_type: AIProviderType,
    model: Option<String>,
    cli_path: Option<String>,
}

impl CliProvider {
    pub fn new(
        id: String,
        name: String,
        provider_type: AIProviderType,
        model: Option<String>,
        cli_path: Option<String>,
    ) -> Self {
        Self { id, name, provider_type, model, cli_path }
    }

    /// Resolve the command to use (custom path or auto-detect)
    fn resolve_command(&self) -> Result<String, AIError> {
        if let Some(path) = &self.cli_path {
            return Ok(path.clone());
        }

        let config = get_binary_config(self.provider_type)
            .ok_or_else(|| AIError::NotConfigured("Unknown CLI provider type".to_string()))?;

        for name in &config.command_names {
            if which::which(name).is_ok() {
                return Ok(name.to_string());
            }
        }

        Err(AIError::CliNotFound(format!(
            "{} not found in PATH",
            config.label
        )))
    }

    /// Check if a CLI binary is available
    pub async fn check_binary(
        provider_type: AIProviderType,
        custom_path: Option<&str>,
    ) -> CliCheckResponse {
        let config = match get_binary_config(provider_type) {
            Some(c) => c,
            None => return CliCheckResponse {
                provider_type,
                available: false,
                version: None,
                path: None,
                error: Some("Not a CLI provider type".to_string()),
            },
        };

        // Build list of commands to try
        let commands_to_try: Vec<String> = if let Some(path) = custom_path {
            vec![path.to_string()]
        } else {
            config.command_names.iter().map(|s| s.to_string()).collect()
        };

        for cmd in &commands_to_try {
            match Command::new(cmd)
                .arg(config.version_arg)
                .output()
                .await
            {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let version = if version.is_empty() {
                        // Some tools output version to stderr
                        let stderr_ver = String::from_utf8_lossy(&output.stderr).trim().to_string();
                        if stderr_ver.is_empty() { None } else { Some(stderr_ver) }
                    } else {
                        Some(version)
                    };
                    let path = which::which(cmd)
                        .ok()
                        .map(|p| p.to_string_lossy().to_string())
                        .or_else(|| Some(cmd.clone()));

                    return CliCheckResponse {
                        provider_type,
                        available: true,
                        version,
                        path,
                        error: None,
                    };
                }
                Ok(output) => {
                    debug!("{} returned non-zero: {}", cmd, String::from_utf8_lossy(&output.stderr));
                }
                Err(e) => {
                    debug!("{} not found or failed: {}", cmd, e);
                }
            }
        }

        CliCheckResponse {
            provider_type,
            available: false,
            version: None,
            path: None,
            error: Some(format!("{} not found in PATH", config.label)),
        }
    }

    /// List available models for a CLI binary
    pub async fn list_models(
        provider_type: AIProviderType,
        custom_path: Option<&str>,
    ) -> ModelsResponse {
        let config = match get_binary_config(provider_type) {
            Some(c) => c,
            None => return ModelsResponse {
                provider_type,
                models: vec![],
            },
        };

        // Hardcoded fallback lists
        match provider_type {
            AIProviderType::ClaudeCli => {
                return ModelsResponse {
                    provider_type,
                    models: vec![
                        AvailableModel { id: "opus".to_string(), name: Some("Claude Opus (latest)".to_string()) },
                        AvailableModel { id: "sonnet".to_string(), name: Some("Claude Sonnet (latest)".to_string()) },
                        AvailableModel { id: "haiku".to_string(), name: Some("Claude Haiku (latest)".to_string()) },
                    ],
                };
            }
            AIProviderType::GeminiCli => {
                return ModelsResponse {
                    provider_type,
                    models: vec![
                        AvailableModel { id: "gemini-2.5-pro".to_string(), name: Some("Gemini 2.5 Pro".to_string()) },
                        AvailableModel { id: "gemini-2.5-flash".to_string(), name: Some("Gemini 2.5 Flash".to_string()) },
                        AvailableModel { id: "gemini-2.0-flash".to_string(), name: Some("Gemini 2.0 Flash".to_string()) },
                    ],
                };
            }
            AIProviderType::CustomCli => {
                return ModelsResponse {
                    provider_type,
                    models: vec![],
                };
            }
            _ => {}
        }

        // Dynamic model listing via CLI command
        let list_cmd = match &config.list_models_cmd {
            Some(cmd) => cmd.clone(),
            None => return ModelsResponse { provider_type, models: vec![] },
        };

        // Resolve actual command
        let cmd_name = if let Some(path) = custom_path {
            path.to_string()
        } else {
            let mut found = None;
            for name in &config.command_names {
                if which::which(name).is_ok() {
                    found = Some(name.to_string());
                    break;
                }
            }
            match found {
                Some(c) => c,
                None => return ModelsResponse { provider_type, models: vec![] },
            }
        };

        let args: Vec<&str> = list_cmd.iter().skip(1).copied().collect();

        let output = match Command::new(&cmd_name)
            .args(&args)
            .output()
            .await
        {
            Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).to_string(),
            Ok(o) => {
                warn!("Model listing failed for {}: {}", cmd_name, String::from_utf8_lossy(&o.stderr));
                return ModelsResponse { provider_type, models: vec![] };
            }
            Err(e) => {
                warn!("Failed to run model listing for {}: {}", cmd_name, e);
                return ModelsResponse { provider_type, models: vec![] };
            }
        };

        let models = match provider_type {
            AIProviderType::OllamaCli => parse_ollama_models(&output),
            AIProviderType::LlmCli => parse_llm_models(&output),
            AIProviderType::OpencodeCli => parse_opencode_models(&output),
            _ => vec![],
        };

        ModelsResponse { provider_type, models }
    }

    /// Fetch models from API endpoints (Anthropic, OpenAI)
    pub async fn list_api_models(
        provider_type: AIProviderType,
        api_key: &str,
    ) -> ModelsResponse {
        let models = match provider_type {
            AIProviderType::AnthropicApi => fetch_anthropic_models(api_key).await,
            AIProviderType::OpenaiApi => fetch_openai_models(api_key).await,
            _ => vec![],
        };

        ModelsResponse { provider_type, models }
    }

    /// Validate that a path points to a valid executable
    pub async fn validate_path(path: &str) -> ValidateCliPathResponse {
        let path_buf = std::path::Path::new(path);

        if !path_buf.exists() {
            return ValidateCliPathResponse {
                valid: false,
                version: None,
                error: Some("File does not exist".to_string()),
            };
        }

        // Try running --version
        match Command::new(path)
            .arg("--version")
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let version = if version.is_empty() {
                    let v = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    if v.is_empty() { None } else { Some(v) }
                } else {
                    Some(version)
                };

                ValidateCliPathResponse {
                    valid: true,
                    version,
                    error: None,
                }
            }
            Ok(output) => {
                ValidateCliPathResponse {
                    valid: false,
                    version: None,
                    error: Some(format!(
                        "Command exited with status {}: {}",
                        output.status,
                        String::from_utf8_lossy(&output.stderr).trim()
                    )),
                }
            }
            Err(e) => {
                ValidateCliPathResponse {
                    valid: false,
                    version: None,
                    error: Some(format!("Failed to execute: {}", e)),
                }
            }
        }
    }
}

#[async_trait]
impl AIProviderTrait for CliProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    async fn check_availability(&self) -> Result<bool, AIError> {
        let check = Self::check_binary(self.provider_type, self.cli_path.as_deref()).await;
        Ok(check.available)
    }

    async fn analyze(&self, context: &AnalysisContext) -> Result<Vec<RawSuggestion>, AIError> {
        let cmd_str = self.resolve_command()?;
        let config = get_binary_config(self.provider_type)
            .ok_or_else(|| AIError::NotConfigured("Unknown CLI provider type".to_string()))?;

        let prompt = build_analysis_prompt(context);
        info!("Starting {} analysis for MR {}", config.label, context.mr_id);
        debug!("Prompt length: {} characters", prompt.len());

        let mut cmd = Command::new(&cmd_str);

        // Build command args based on binary type
        match self.provider_type {
            AIProviderType::OllamaCli => {
                // ollama run <model> (model is required and positional)
                cmd.arg("run");
                if let Some(model) = &self.model {
                    cmd.arg(model);
                } else {
                    return Err(AIError::NotConfigured("Ollama requires a model to be specified".to_string()));
                }
            }
            AIProviderType::OpencodeCli => {
                // opencode run "prompt" --model <model>
                // For stdin-based: opencode run with stdin
                cmd.arg("run");
                if let Some(model) = &self.model {
                    cmd.arg("--model").arg(model);
                }
            }
            _ => {
                // Generic: add invoke args, then model flag if present
                for arg in &config.invoke_args {
                    cmd.arg(arg);
                }
                if let Some(model) = &self.model {
                    if let Some(flag) = config.model_flag {
                        cmd.arg(flag).arg(model);
                    }
                }
            }
        }

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AIError::CliNotFound(format!("{} not found", cmd_str))
            } else {
                AIError::CliExecutionFailed(e.to_string())
            }
        })?;

        // Write prompt to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(prompt.as_bytes()).await
                .map_err(|e| AIError::CliExecutionFailed(format!("Failed to write to stdin: {}", e)))?;
        }

        let output = child.wait_with_output().await
            .map_err(|e| AIError::CliExecutionFailed(format!("Failed to wait for output: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AIError::CliExecutionFailed(format!(
                "{} exited with status {}: {}",
                config.label, output.status, stderr
            )));
        }

        let response = String::from_utf8_lossy(&output.stdout).to_string();
        debug!("{} response length: {} characters", config.label, response.len());

        let suggestions = parse_suggestions_response(&response)?;
        info!("{} analysis complete: {} suggestions", config.label, suggestions.len());

        Ok(suggestions)
    }
}

// ============================================================================
// Model list parsers
// ============================================================================

/// Parse `ollama list` output (table format: NAME, ID, SIZE, MODIFIED)
fn parse_ollama_models(output: &str) -> Vec<AvailableModel> {
    let mut models = Vec::new();
    for line in output.lines().skip(1) {
        // Skip header line
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(name) = parts.first() {
            let name = name.trim();
            if !name.is_empty() {
                models.push(AvailableModel {
                    id: name.to_string(),
                    name: None,
                });
            }
        }
    }
    models
}

/// Parse `llm models` output (one model per line, various formats)
fn parse_llm_models(output: &str) -> Vec<AvailableModel> {
    let mut models = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Usage") || line.starts_with("--") {
            continue;
        }
        // llm models outputs like "OpenAI Chat: gpt-4o" or just model names
        let model_id = if let Some(idx) = line.find(": ") {
            line[idx + 2..].trim()
        } else {
            line
        };
        if !model_id.is_empty() && !model_id.contains(' ') {
            models.push(AvailableModel {
                id: model_id.to_string(),
                name: Some(line.to_string()),
            });
        }
    }
    models
}

/// Parse `opencode models` output
fn parse_opencode_models(output: &str) -> Vec<AvailableModel> {
    let mut models = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Available") || line.starts_with("---") {
            continue;
        }
        // OpenCode may output provider/model format
        if line.contains('/') || (!line.contains(' ') && !line.is_empty()) {
            models.push(AvailableModel {
                id: line.to_string(),
                name: None,
            });
        }
    }
    models
}

// ============================================================================
// API model fetchers
// ============================================================================

/// Fetch models from Anthropic API
async fn fetch_anthropic_models(api_key: &str) -> Vec<AvailableModel> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;

    let resp = match resp {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            warn!("Anthropic models API returned {}", r.status());
            return vec![];
        }
        Err(e) => {
            warn!("Failed to fetch Anthropic models: {}", e);
            return vec![];
        }
    };

    let body: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse Anthropic models response: {}", e);
            return vec![];
        }
    };

    let mut models = Vec::new();
    if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
        for item in data {
            let id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let display_name = item.get("display_name").and_then(|v| v.as_str());
            if !id.is_empty() {
                models.push(AvailableModel {
                    id: id.to_string(),
                    name: display_name.map(|s| s.to_string()),
                });
            }
        }
    }

    models
}

/// Fetch models from OpenAI API
async fn fetch_openai_models(api_key: &str) -> Vec<AvailableModel> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await;

    let resp = match resp {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            warn!("OpenAI models API returned {}", r.status());
            return vec![];
        }
        Err(e) => {
            warn!("Failed to fetch OpenAI models: {}", e);
            return vec![];
        }
    };

    let body: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse OpenAI models response: {}", e);
            return vec![];
        }
    };

    let mut models = Vec::new();
    if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
        for item in data {
            let id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            // Filter to chat-capable models
            if !id.is_empty() && (id.starts_with("gpt-") || id.starts_with("o1") || id.starts_with("o3") || id.starts_with("chatgpt")) {
                models.push(AvailableModel {
                    id: id.to_string(),
                    name: None,
                });
            }
        }
    }

    // Sort by model ID
    models.sort_by(|a, b| a.id.cmp(&b.id));
    models
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ollama_models() {
        let output = "NAME           ID           SIZE    MODIFIED\nllama3:latest  abc123       4.7 GB  2 days ago\ncodellama:7b   def456       3.8 GB  1 week ago\n";
        let models = parse_ollama_models(output);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "llama3:latest");
        assert_eq!(models[1].id, "codellama:7b");
    }

    #[test]
    fn test_parse_llm_models() {
        let output = "OpenAI Chat: gpt-4o\nOpenAI Chat: gpt-4o-mini\nClaude: claude-sonnet-4-20250514\n";
        let models = parse_llm_models(output);
        assert_eq!(models.len(), 3);
        assert_eq!(models[0].id, "gpt-4o");
        assert_eq!(models[1].id, "gpt-4o-mini");
    }

    #[test]
    fn test_get_binary_config() {
        assert!(get_binary_config(AIProviderType::ClaudeCli).is_some());
        assert!(get_binary_config(AIProviderType::OllamaCli).is_some());
        assert!(get_binary_config(AIProviderType::AnthropicApi).is_none());
    }
}
