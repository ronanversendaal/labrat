//! Settings structure and persistence
//!
//! This module defines the application settings and their defaults.

use serde::{Deserialize, Serialize};

/// Application theme
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

impl std::fmt::Display for Theme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Theme::Light => write!(f, "light"),
            Theme::Dark => write!(f, "dark"),
            Theme::System => write!(f, "system"),
        }
    }
}

/// Diff view mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DiffViewMode {
    #[default]
    Unified,
    Split,
}

impl std::fmt::Display for DiffViewMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DiffViewMode::Unified => write!(f, "unified"),
            DiffViewMode::Split => write!(f, "split"),
        }
    }
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub theme: Theme,

    #[serde(default = "default_refresh_interval")]
    pub mr_refresh_interval_seconds: i32,

    #[serde(default = "default_cache_size")]
    pub cache_size_mb: i32,

    #[serde(default = "default_true")]
    pub ai_auto_analyze: bool,

    pub default_ai_provider_id: Option<String>,

    #[serde(default)]
    pub sidebar_collapsed: bool,

    #[serde(default)]
    pub diff_view_mode: DiffViewMode,

    #[serde(default)]
    pub show_whitespace: bool,

    #[serde(default = "default_font_size")]
    pub font_size: i32,

    #[serde(default = "default_true")]
    pub keyboard_shortcuts_enabled: bool,
}

fn default_refresh_interval() -> i32 {
    300 // 5 minutes
}

fn default_cache_size() -> i32 {
    500 // 500 MB
}

fn default_font_size() -> i32 {
    14
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            mr_refresh_interval_seconds: default_refresh_interval(),
            cache_size_mb: default_cache_size(),
            ai_auto_analyze: true,
            default_ai_provider_id: None,
            sidebar_collapsed: false,
            diff_view_mode: DiffViewMode::default(),
            show_whitespace: false,
            font_size: default_font_size(),
            keyboard_shortcuts_enabled: true,
        }
    }
}

/// Request to update settings (partial update)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateSettingsRequest {
    pub theme: Option<Theme>,
    pub mr_refresh_interval_seconds: Option<i32>,
    pub cache_size_mb: Option<i32>,
    pub ai_auto_analyze: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub default_ai_provider_id: Option<Option<String>>,
    pub sidebar_collapsed: Option<bool>,
    pub diff_view_mode: Option<DiffViewMode>,
    pub show_whitespace: Option<bool>,
    pub font_size: Option<i32>,
    pub keyboard_shortcuts_enabled: Option<bool>,
}

/// Deserialize a field that can be null, absent, or present
fn deserialize_optional_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

impl Settings {
    /// Apply a partial update to the settings
    pub fn apply_update(&mut self, update: UpdateSettingsRequest) {
        if let Some(theme) = update.theme {
            self.theme = theme;
        }
        if let Some(interval) = update.mr_refresh_interval_seconds {
            self.mr_refresh_interval_seconds = interval;
        }
        if let Some(size) = update.cache_size_mb {
            self.cache_size_mb = size;
        }
        if let Some(auto) = update.ai_auto_analyze {
            self.ai_auto_analyze = auto;
        }
        if let Some(provider_id) = update.default_ai_provider_id {
            self.default_ai_provider_id = provider_id;
        }
        if let Some(collapsed) = update.sidebar_collapsed {
            self.sidebar_collapsed = collapsed;
        }
        if let Some(mode) = update.diff_view_mode {
            self.diff_view_mode = mode;
        }
        if let Some(show) = update.show_whitespace {
            self.show_whitespace = show;
        }
        if let Some(size) = update.font_size {
            self.font_size = size;
        }
        if let Some(enabled) = update.keyboard_shortcuts_enabled {
            self.keyboard_shortcuts_enabled = enabled;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = Settings::default();
        assert_eq!(settings.theme, Theme::System);
        assert_eq!(settings.mr_refresh_interval_seconds, 300);
        assert_eq!(settings.cache_size_mb, 500);
        assert!(settings.ai_auto_analyze);
        assert_eq!(settings.font_size, 14);
    }

    #[test]
    fn test_apply_update() {
        let mut settings = Settings::default();
        let update = UpdateSettingsRequest {
            theme: Some(Theme::Dark),
            font_size: Some(16),
            ..Default::default()
        };

        settings.apply_update(update);

        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.font_size, 16);
        // Other fields should remain unchanged
        assert_eq!(settings.mr_refresh_interval_seconds, 300);
    }
}
