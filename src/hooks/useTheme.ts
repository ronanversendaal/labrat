import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { resolveThemeId, getThemeType, THEME_LIST } from '../types/settings';
import { setWindowBgColor } from '../services/tauri';
import type { ThemeId } from '../types/settings';

/** Subscribe to OS dark mode preference */
function subscribeToMediaQuery(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Parse "#rrggbb" to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Returns the resolved theme ID (never 'system').
 * Re-renders when OS preference changes if theme is 'system'.
 */
export function useResolvedTheme(): Exclude<ThemeId, 'system'> {
  const theme = useSettingsStore((s) => s.theme);
  const prefersDark = useSyncExternalStore(subscribeToMediaQuery, getPrefersDark);
  return resolveThemeId(theme, prefersDark);
}

/**
 * Synchronizes the theme setting with the DOM.
 * Sets `data-theme` attribute and `color-scheme` on <html>.
 * Syncs the native window background color with the theme.
 * Applies font overrides when user has custom fonts.
 */
export function useThemeSync() {
  const resolvedTheme = useResolvedTheme();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamilyUI = useSettingsStore((s) => s.fontFamilyUI);
  const fontFamilyCode = useSettingsStore((s) => s.fontFamilyCode);

  useEffect(() => {
    const root = document.documentElement;

    // Set theme attribute (drives CSS variable selection)
    root.setAttribute('data-theme', resolvedTheme);

    // Set color-scheme for native elements (scrollbars, form controls)
    const themeType = getThemeType(resolvedTheme);
    root.style.colorScheme = themeType;

    // Sync native window background color with the theme canvas color.
    // This makes the macOS overlay titlebar and resize edges match the theme.
    const meta = THEME_LIST.find((t) => t.id === resolvedTheme);
    if (meta) {
      const [r, g, b] = hexToRgb(meta.colors.canvas);
      setWindowBgColor(r, g, b).catch(() => {
        // Silently ignore — fails in browser mode or non-macOS
      });
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;

    // Apply code font size as a CSS variable for non-Monaco code blocks
    root.style.setProperty('--th-font-size-code', `${fontSize}px`);

    // Apply font overrides
    if (fontFamilyUI) {
      root.style.setProperty('--th-font-ui', fontFamilyUI);
    } else {
      root.style.removeProperty('--th-font-ui');
    }
    if (fontFamilyCode) {
      root.style.setProperty('--th-font-code', fontFamilyCode);
    } else {
      root.style.removeProperty('--th-font-code');
    }
  }, [fontSize, fontFamilyUI, fontFamilyCode]);
}
