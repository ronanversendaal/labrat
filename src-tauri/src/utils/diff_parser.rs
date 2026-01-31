//! Unified diff parsing and syntax highlighting
//!
//! This module provides utilities for parsing unified diff format and
//! applying syntax highlighting to code content.

use crate::gitlab::types::{HighlightedLine, LineType};
use syntect::easy::HighlightLines;
use syntect::highlighting::{Style, ThemeSet};
use syntect::parsing::SyntaxSet;
use thiserror::Error;

/// Errors related to diff parsing
#[derive(Debug, Error)]
pub enum DiffParserError {
    #[error("Failed to parse diff header: {0}")]
    InvalidHeader(String),

    #[error("Syntax highlighting error: {0}")]
    HighlightError(String),
}

/// Represents a parsed line from a unified diff
#[derive(Debug, Clone)]
pub struct ParsedDiffLine {
    pub line_type: LineType,
    pub old_line: Option<i32>,
    pub new_line: Option<i32>,
    pub content: String,
}

/// Parse a unified diff string into structured lines
pub fn parse_unified_diff(diff: &str) -> Vec<ParsedDiffLine> {
    let mut lines = Vec::new();
    let mut old_line: i32 = 0;
    let mut new_line: i32 = 0;

    for raw_line in diff.lines() {
        if raw_line.starts_with("@@") {
            // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
            if let Some((old_start, new_start)) = parse_hunk_header(raw_line) {
                old_line = old_start;
                new_line = new_start;
            }
            lines.push(ParsedDiffLine {
                line_type: LineType::Header,
                old_line: None,
                new_line: None,
                content: raw_line.to_string(),
            });
        } else if raw_line.starts_with("---") || raw_line.starts_with("+++") {
            // File header lines - skip or include as header
            lines.push(ParsedDiffLine {
                line_type: LineType::Header,
                old_line: None,
                new_line: None,
                content: raw_line.to_string(),
            });
        } else if raw_line.starts_with('+') {
            // Addition
            lines.push(ParsedDiffLine {
                line_type: LineType::Addition,
                old_line: None,
                new_line: Some(new_line),
                content: raw_line[1..].to_string(),
            });
            new_line += 1;
        } else if raw_line.starts_with('-') {
            // Deletion
            lines.push(ParsedDiffLine {
                line_type: LineType::Deletion,
                old_line: Some(old_line),
                new_line: None,
                content: raw_line[1..].to_string(),
            });
            old_line += 1;
        } else if raw_line.starts_with(' ') || raw_line.is_empty() {
            // Context line
            let content = if raw_line.is_empty() {
                String::new()
            } else {
                raw_line[1..].to_string()
            };
            lines.push(ParsedDiffLine {
                line_type: LineType::Context,
                old_line: Some(old_line),
                new_line: Some(new_line),
                content,
            });
            old_line += 1;
            new_line += 1;
        } else {
            // No change or other content - treat as context
            lines.push(ParsedDiffLine {
                line_type: LineType::Context,
                old_line: Some(old_line),
                new_line: Some(new_line),
                content: raw_line.to_string(),
            });
            old_line += 1;
            new_line += 1;
        }
    }

    lines
}

/// Parse hunk header to extract starting line numbers
fn parse_hunk_header(line: &str) -> Option<(i32, i32)> {
    // Format: @@ -old_start[,old_count] +new_start[,new_count] @@
    let parts: Vec<&str> = line.split_whitespace().collect();

    if parts.len() < 4 {
        return None;
    }

    let old_part = parts[1].trim_start_matches('-');
    let new_part = parts[2].trim_start_matches('+');

    let old_start: i32 = old_part
        .split(',')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    let new_start: i32 = new_part
        .split(',')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    Some((old_start, new_start))
}

/// Syntax highlighter using syntect
pub struct SyntaxHighlighter {
    syntax_set: SyntaxSet,
    theme_set: ThemeSet,
}

impl Default for SyntaxHighlighter {
    fn default() -> Self {
        Self::new()
    }
}

impl SyntaxHighlighter {
    /// Create a new syntax highlighter with default themes
    pub fn new() -> Self {
        Self {
            syntax_set: SyntaxSet::load_defaults_newlines(),
            theme_set: ThemeSet::load_defaults(),
        }
    }

    /// Detect the syntax for a file based on its extension
    pub fn detect_syntax(&self, file_path: &str) -> Option<&syntect::parsing::SyntaxReference> {
        self.syntax_set.find_syntax_for_file(file_path).ok().flatten()
    }

    /// Highlight diff lines for a file
    pub fn highlight_diff(
        &self,
        diff: &str,
        file_path: &str,
        theme: &str,
    ) -> Result<Vec<HighlightedLine>, DiffParserError> {
        let theme = self
            .theme_set
            .themes
            .get(theme)
            .unwrap_or_else(|| self.theme_set.themes.values().next().unwrap());

        let syntax = self
            .syntax_set
            .find_syntax_for_file(file_path)
            .ok()
            .flatten()
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());

        let mut highlighter = HighlightLines::new(syntax, theme);

        let parsed_lines = parse_unified_diff(diff);

        let highlighted: Vec<HighlightedLine> = parsed_lines
            .into_iter()
            .map(|line| {
                let html = match line.line_type {
                    LineType::Header => {
                        // Don't syntax highlight headers
                        escape_html(&line.content)
                    }
                    _ => {
                        // Syntax highlight code content
                        let ranges = highlighter
                            .highlight_line(&line.content, &self.syntax_set)
                            .unwrap_or_default();
                        styled_ranges_to_html(&ranges)
                    }
                };

                HighlightedLine {
                    line_type: line.line_type,
                    old_line: line.old_line,
                    new_line: line.new_line,
                    content: line.content,
                    html,
                }
            })
            .collect();

        Ok(highlighted)
    }

    /// Get available theme names
    pub fn available_themes(&self) -> Vec<&str> {
        self.theme_set.themes.keys().map(|s| s.as_str()).collect()
    }
}

/// Convert syntect styles to HTML spans
fn styled_ranges_to_html(ranges: &[(Style, &str)]) -> String {
    let mut html = String::new();

    for (style, text) in ranges {
        let r = style.foreground.r;
        let g = style.foreground.g;
        let b = style.foreground.b;

        let escaped = escape_html(text);
        html.push_str(&format!(
            "<span style=\"color:rgb({},{},{})\">{}",
            r, g, b, escaped
        ));
        html.push_str("</span>");
    }

    html
}

/// Escape HTML special characters
fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hunk_header() {
        assert_eq!(parse_hunk_header("@@ -1,3 +1,4 @@"), Some((1, 1)));
        assert_eq!(parse_hunk_header("@@ -10,5 +15,7 @@"), Some((10, 15)));
        assert_eq!(parse_hunk_header("@@ -1 +1 @@"), Some((1, 1)));
    }

    #[test]
    fn test_parse_unified_diff() {
        let diff = r#"--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 context line
-deleted line
+added line
+another added line
 more context
"#;

        let lines = parse_unified_diff(diff);

        assert_eq!(lines.len(), 8);
        assert_eq!(lines[0].line_type, LineType::Header); // --- a/file.txt
        assert_eq!(lines[1].line_type, LineType::Header); // +++ b/file.txt
        assert_eq!(lines[2].line_type, LineType::Header); // @@ hunk
        assert_eq!(lines[3].line_type, LineType::Context);
        assert_eq!(lines[4].line_type, LineType::Deletion);
        assert_eq!(lines[5].line_type, LineType::Addition);
        assert_eq!(lines[6].line_type, LineType::Addition);
        assert_eq!(lines[7].line_type, LineType::Context);
    }

    #[test]
    fn test_syntax_highlighter_detection() {
        let highlighter = SyntaxHighlighter::new();

        // Should detect TypeScript
        assert!(highlighter.detect_syntax("test.ts").is_some());
        assert!(highlighter.detect_syntax("test.tsx").is_some());

        // Should detect Rust
        assert!(highlighter.detect_syntax("main.rs").is_some());

        // Should detect JavaScript
        assert!(highlighter.detect_syntax("app.js").is_some());
    }

    #[test]
    fn test_escape_html() {
        assert_eq!(escape_html("<div>"), "&lt;div&gt;");
        assert_eq!(escape_html("a & b"), "a &amp; b");
        assert_eq!(escape_html("\"test\""), "&quot;test&quot;");
    }
}
