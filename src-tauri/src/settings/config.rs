//! Settings structure and persistence
//!
//! This module defines the application settings and their defaults.

use serde::{Deserialize, Serialize};

/// Application theme
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Theme {
    #[serde(rename = "system")]
    #[default]
    System,
    #[serde(rename = "default-light")]
    DefaultLight,
    #[serde(rename = "default-dark")]
    DefaultDark,
    #[serde(rename = "kanagawa")]
    Kanagawa,
    #[serde(rename = "catppuccin-mocha")]
    CatppuccinMocha,
    #[serde(rename = "rose-pine")]
    RosePine,
}

impl std::fmt::Display for Theme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Theme::System => write!(f, "system"),
            Theme::DefaultLight => write!(f, "default-light"),
            Theme::DefaultDark => write!(f, "default-dark"),
            Theme::Kanagawa => write!(f, "kanagawa"),
            Theme::CatppuccinMocha => write!(f, "catppuccin-mocha"),
            Theme::RosePine => write!(f, "rose-pine"),
        }
    }
}

impl Theme {
    /// Parse from database string, with backward compatibility for old values
    pub fn from_db_str(s: &str) -> Self {
        match s {
            "default-light" | "light" => Theme::DefaultLight,
            "default-dark" | "dark" => Theme::DefaultDark,
            "kanagawa" => Theme::Kanagawa,
            "catppuccin-mocha" => Theme::CatppuccinMocha,
            "rose-pine" => Theme::RosePine,
            _ => Theme::System,
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

    #[serde(default)]
    pub font_family_ui: Option<String>,

    #[serde(default)]
    pub font_family_code: Option<String>,
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
            font_family_ui: None,
            font_family_code: None,
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
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub font_family_ui: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub font_family_code: Option<Option<String>>,
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
        if let Some(font_ui) = update.font_family_ui {
            self.font_family_ui = font_ui;
        }
        if let Some(font_code) = update.font_family_code {
            self.font_family_code = font_code;
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
        assert_eq!(settings.font_family_ui, None);
        assert_eq!(settings.font_family_code, None);
    }

    #[test]
    fn test_apply_update() {
        let mut settings = Settings::default();
        let update = UpdateSettingsRequest {
            theme: Some(Theme::DefaultDark),
            font_size: Some(16),
            ..Default::default()
        };

        settings.apply_update(update);

        assert_eq!(settings.theme, Theme::DefaultDark);
        assert_eq!(settings.font_size, 16);
        assert_eq!(settings.mr_refresh_interval_seconds, 300);
    }

    #[test]
    fn test_theme_from_db_str() {
        assert_eq!(Theme::from_db_str("light"), Theme::DefaultLight);
        assert_eq!(Theme::from_db_str("dark"), Theme::DefaultDark);
        assert_eq!(Theme::from_db_str("default-light"), Theme::DefaultLight);
        assert_eq!(Theme::from_db_str("default-dark"), Theme::DefaultDark);
        assert_eq!(Theme::from_db_str("kanagawa"), Theme::Kanagawa);
        assert_eq!(Theme::from_db_str("catppuccin-mocha"), Theme::CatppuccinMocha);
        assert_eq!(Theme::from_db_str("rose-pine"), Theme::RosePine);
        assert_eq!(Theme::from_db_str("system"), Theme::System);
        assert_eq!(Theme::from_db_str("unknown"), Theme::System);
    }

    #[test]
    fn test_theme_display() {
        assert_eq!(Theme::System.to_string(), "system");
        assert_eq!(Theme::DefaultLight.to_string(), "default-light");
        assert_eq!(Theme::DefaultDark.to_string(), "default-dark");
        assert_eq!(Theme::Kanagawa.to_string(), "kanagawa");
        assert_eq!(Theme::CatppuccinMocha.to_string(), "catppuccin-mocha");
        assert_eq!(Theme::RosePine.to_string(), "rose-pine");
    }

    #[test]
    fn test_theme_serde_roundtrip() {
        let json = serde_json::to_string(&Theme::CatppuccinMocha).unwrap();
        assert_eq!(json, "\"catppuccin-mocha\"");
        let parsed: Theme = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, Theme::CatppuccinMocha);
    }

    #[test]
    fn test_font_update() {
        let mut settings = Settings::default();
        let update = UpdateSettingsRequest {
            font_family_ui: Some(Some("Inter".to_string())),
            font_family_code: Some(Some("Fira Code".to_string())),
            ..Default::default()
        };
        settings.apply_update(update);
        assert_eq!(settings.font_family_ui, Some("Inter".to_string()));
        assert_eq!(settings.font_family_code, Some("Fira Code".to_string()));

        // Clear font
        let update2 = UpdateSettingsRequest {
            font_family_ui: Some(None),
            ..Default::default()
        };
        settings.apply_update(update2);
        assert_eq!(settings.font_family_ui, None);
    }
}
