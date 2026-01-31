//! Claude CLI AI provider
//!
//! This module implements AI analysis using the Claude CLI tool.

use async_trait::async_trait;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing::{debug, info, warn};

use super::provider::{AIError, AIProvider, AnalysisContext, RawSuggestion, build_analysis_prompt, parse_suggestions_response};

/// Default CLI command name
const CLAUDE_CLI_NAME: &str = "claude";

/// Claude CLI provider
pub struct ClaudeCliProvider {
    id: String,
    name: String,
    cli_path: Option<String>,
}

impl ClaudeCliProvider {
    /// Create a new Claude CLI provider
    pub fn new(id: String, name: String, cli_path: Option<String>) -> Self {
        Self { id, name, cli_path }
    }

    /// Get the CLI executable path
    fn cli_command(&self) -> &str {
        self.cli_path.as_deref().unwrap_or(CLAUDE_CLI_NAME)
    }

    /// Check if Claude CLI is installed and get version
    pub async fn check_cli() -> Result<(bool, Option<String>, Option<String>), AIError> {
        // Try to find the CLI
        let cli_names = ["claude", "claude-cli"];

        for cli_name in cli_names {
            match Command::new(cli_name)
                .arg("--version")
                .output()
                .await
            {
                Ok(output) => {
                    if output.status.success() {
                        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        let path = which::which(cli_name)
                            .ok()
                            .map(|p| p.to_string_lossy().to_string());
                        return Ok((true, Some(version), path));
                    }
                }
                Err(_) => continue,
            }
        }

        Ok((false, None, None))
    }
}

#[async_trait]
impl AIProvider for ClaudeCliProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    async fn check_availability(&self) -> Result<bool, AIError> {
        let cli_cmd = self.cli_command();

        match Command::new(cli_cmd)
            .arg("--version")
            .output()
            .await
        {
            Ok(output) => {
                if output.status.success() {
                    debug!("Claude CLI is available: {}", String::from_utf8_lossy(&output.stdout).trim());
                    Ok(true)
                } else {
                    warn!("Claude CLI returned error: {}", String::from_utf8_lossy(&output.stderr));
                    Ok(false)
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    Ok(false)
                } else {
                    Err(AIError::CliExecutionFailed(e.to_string()))
                }
            }
        }
    }

    async fn analyze(&self, context: &AnalysisContext) -> Result<Vec<RawSuggestion>, AIError> {
        let cli_cmd = self.cli_command();
        let prompt = build_analysis_prompt(context);

        info!("Starting Claude CLI analysis for MR {}", context.mr_id);
        debug!("Prompt length: {} characters", prompt.len());

        // Run Claude CLI with the prompt via stdin
        let mut child = Command::new(cli_cmd)
            .arg("--print")  // Just print response without interactive mode
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    AIError::CliNotFound(format!("{} not found in PATH", cli_cmd))
                } else {
                    AIError::CliExecutionFailed(e.to_string())
                }
            })?;

        // Write prompt to stdin
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(prompt.as_bytes()).await
                .map_err(|e| AIError::CliExecutionFailed(format!("Failed to write to stdin: {}", e)))?;
        }

        // Wait for output
        let output = child.wait_with_output().await
            .map_err(|e| AIError::CliExecutionFailed(format!("Failed to wait for output: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AIError::CliExecutionFailed(format!(
                "CLI exited with status {}: {}",
                output.status,
                stderr
            )));
        }

        let response = String::from_utf8_lossy(&output.stdout).to_string();
        debug!("Claude CLI response length: {} characters", response.len());

        // Parse the response
        let suggestions = parse_suggestions_response(&response)?;
        info!("Claude CLI analysis complete: {} suggestions", suggestions.len());

        Ok(suggestions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cli_check() {
        // This test just verifies the check doesn't crash
        let (available, version, path) = ClaudeCliProvider::check_cli().await.unwrap();
        println!("Claude CLI available: {}, version: {:?}, path: {:?}", available, version, path);
    }
}
