//! Window customization commands (titlebar color sync)

use crate::TauriResult;

/// Set the native window background color to match the current theme.
///
/// On macOS with a transparent/overlay titlebar, the NSWindow background color
/// is visible in the titlebar area and during resize. This command syncs it
/// with the active CSS theme so the window chrome looks uniform.
#[tauri::command]
pub fn set_window_bg_color(window: tauri::WebviewWindow, r: u8, g: u8, b: u8) -> TauriResult<()> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::{id, nil};

        let ns_win = window
            .ns_window()
            .map_err(|_| crate::TauriError::new("window_error", "Failed to get NSWindow"))?
            as id;

        unsafe {
            let color = NSColor::colorWithRed_green_blue_alpha_(
                nil,
                r as f64 / 255.0,
                g as f64 / 255.0,
                b as f64 / 255.0,
                1.0,
            );
            ns_win.setBackgroundColor_(color);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, r, g, b);
    }

    Ok(())
}
