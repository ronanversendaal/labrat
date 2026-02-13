/**
 * ThemePicker - Visual theme selection with color swatch cards
 */

import { THEME_LIST, type ThemeId, type ThemeMeta } from '../../types/settings';
import { useSettingsStore } from '../../stores/settingsStore';
import { useResolvedTheme } from '../../hooks/useTheme';

function ThemeCard({
  meta,
  selected,
  onClick,
}: {
  meta: ThemeMeta;
  selected: boolean;
  onClick: () => void;
}) {
  const { colors } = meta;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-edge hover:border-edge-strong'
      }`}
    >
      {/* Mini preview */}
      <div
        className="w-full h-16 rounded-md overflow-hidden mb-2 border border-edge"
        style={{ backgroundColor: colors.canvas }}
      >
        {/* Simulated sidebar + content layout */}
        <div className="flex h-full">
          <div
            className="w-6 h-full flex-shrink-0"
            style={{ backgroundColor: colors.surface }}
          />
          <div className="flex-1 p-1.5 flex flex-col gap-1">
            <div
              className="h-1.5 w-3/4 rounded-full"
              style={{ backgroundColor: colors.content, opacity: 0.7 }}
            />
            <div
              className="h-1.5 w-1/2 rounded-full"
              style={{ backgroundColor: colors.contentSecondary, opacity: 0.5 }}
            />
            <div className="flex-1" />
            <div
              className="h-2 w-8 rounded-sm"
              style={{ backgroundColor: colors.primary }}
            />
          </div>
        </div>
      </div>

      {/* Color dots */}
      <div className="flex gap-1 mb-1.5">
        {Object.values(colors).map((color, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full border border-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Label + font hint */}
      <span className="text-xs font-medium text-content">{meta.label}</span>
      <span className="text-[10px] text-content-tertiary">{meta.fonts.ui} / {meta.fonts.code}</span>

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

export function ThemePicker() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const resolvedTheme = useResolvedTheme();
  const isSystem = theme === 'system';

  const handleSystemToggle = (checked: boolean) => {
    if (checked) {
      setTheme('system' as ThemeId);
    } else {
      // When disabling system, lock to the currently resolved theme
      setTheme(resolvedTheme);
    }
  };

  const handleThemeSelect = (id: ThemeId) => {
    // Selecting a specific theme disables system mode
    setTheme(id);
  };

  const activeId = isSystem ? resolvedTheme : theme;

  return (
    <div className="space-y-4">
      {/* System preference toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-content">Follow system theme</p>
          <p className="text-xs text-content-secondary">
            Automatically switch between light and dark
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSystem}
            onChange={(e) => handleSystemToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {/* Light themes */}
      <div>
        <p className="text-xs font-medium text-content-tertiary uppercase tracking-wider mb-2">Light</p>
        <div className="grid grid-cols-4 gap-3">
          {THEME_LIST.filter((t) => t.type === 'light').map((meta) => (
            <ThemeCard
              key={meta.id}
              meta={meta}
              selected={activeId === meta.id}
              onClick={() => handleThemeSelect(meta.id)}
            />
          ))}
        </div>
      </div>

      {/* Dark themes */}
      <div>
        <p className="text-xs font-medium text-content-tertiary uppercase tracking-wider mb-2">Dark</p>
        <div className="grid grid-cols-4 gap-3">
          {THEME_LIST.filter((t) => t.type === 'dark').map((meta) => (
            <ThemeCard
              key={meta.id}
              meta={meta}
              selected={activeId === meta.id}
              onClick={() => handleThemeSelect(meta.id)}
            />
          ))}
        </div>
      </div>

      {isSystem && (
        <p className="text-xs text-content-tertiary">
          Currently using <strong>{THEME_LIST.find((t) => t.id === resolvedTheme)?.label}</strong> based on system preference
        </p>
      )}
    </div>
  );
}
