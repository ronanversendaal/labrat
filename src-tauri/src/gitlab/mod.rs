//! GitLab API client and types
//!
//! This module provides the interface for interacting with
//! the GitLab REST API.

pub mod batcher;
pub mod client;
pub mod comments;
pub mod diffs;
pub mod merge_requests;
pub mod types;
pub mod user;

pub use batcher::{BatchError, MultiBatcher, RequestDeduplicator};
pub use client::{GitLabClient, GitLabClientError, RequestManager};
pub use types::*;
