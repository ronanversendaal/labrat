//! AI provider abstraction
//!
//! This module provides a unified interface for different
//! AI providers (Claude CLI, Anthropic API, OpenAI API).

pub mod anthropic;
pub mod claude_cli;
pub mod openai;
pub mod provider;
pub mod types;

pub use anthropic::AnthropicProvider;
pub use claude_cli::ClaudeCliProvider;
pub use openai::OpenAIProvider;
pub use provider::{AIError, AIProvider, AnalysisContext, FileContext, build_analysis_prompt};
pub use types::*;
