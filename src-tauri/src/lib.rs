//! GitLab MR Review App Backend
//!
//! This is the Rust backend for the GitLab MR Review application,
//! providing API clients, caching, and AI integration.

pub mod ai;
pub mod cache;
pub mod commands;
pub mod gitlab;
pub mod settings;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
