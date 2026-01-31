//! AI provider abstraction
//!
//! This module provides a unified interface for different
//! AI providers (Claude CLI, Anthropic API, OpenAI API).

pub mod anthropic;
pub mod claude_cli;
pub mod openai;
pub mod provider;
