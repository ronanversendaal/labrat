import type { editor } from 'monaco-editor';
import type { ThemeId } from '../../types/settings';

type MonacoThemeDef = editor.IStandaloneThemeData;

/** Get the Monaco theme name for a given app theme id */
export function getMonacoThemeName(themeId: Exclude<ThemeId, 'system'>): string {
  return `labrat-${themeId}`;
}

const defaultLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1e293b',
    'editorLineNumber.foreground': '#94a3b8',
    'editorLineNumber.activeForeground': '#475569',
    'editor.selectionBackground': '#3b82f633',
    'editor.lineHighlightBackground': '#f1f5f900',
    'editorGutter.background': '#f8fafc',
    'diffEditor.insertedTextBackground': '#23863633',
    'diffEditor.removedTextBackground': '#da363333',
    'diffEditor.insertedLineBackground': '#dafbe1',
    'diffEditor.removedLineBackground': '#ffebe9',
  },
};

const defaultDarkTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#111827',
    'editor.foreground': '#f1f5f9',
    'editorLineNumber.foreground': '#64748b',
    'editorLineNumber.activeForeground': '#94a3b8',
    'editor.selectionBackground': '#3b82f633',
    'editor.lineHighlightBackground': '#1f293700',
    'editorGutter.background': '#111827',
    'diffEditor.insertedTextBackground': '#23863633',
    'diffEditor.removedTextBackground': '#da363333',
    'diffEditor.insertedLineBackground': '#23863622',
    'diffEditor.removedLineBackground': '#da363322',
  },
};

const kanagawaTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '727169', fontStyle: 'italic' },
    { token: 'keyword', foreground: '957fb8' },
    { token: 'string', foreground: '98bb6c' },
    { token: 'number', foreground: 'd27e99' },
    { token: 'type', foreground: '7e9cd8' },
    { token: 'variable', foreground: 'dcd7ba' },
    { token: 'function', foreground: '7e9cd8' },
  ],
  colors: {
    'editor.background': '#1f1f28',
    'editor.foreground': '#dcd7ba',
    'editorLineNumber.foreground': '#727169',
    'editorLineNumber.activeForeground': '#c8c093',
    'editor.selectionBackground': '#7e9cd833',
    'editor.lineHighlightBackground': '#2a2a3700',
    'editorGutter.background': '#1f1f28',
    'diffEditor.insertedTextBackground': '#76946a33',
    'diffEditor.removedTextBackground': '#c3404333',
    'diffEditor.insertedLineBackground': '#76946a22',
    'diffEditor.removedLineBackground': '#c3404322',
  },
};

const catppuccinMochaTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'cba6f7' },
    { token: 'string', foreground: 'a6e3a1' },
    { token: 'number', foreground: 'fab387' },
    { token: 'type', foreground: '89b4fa' },
    { token: 'variable', foreground: 'cdd6f4' },
    { token: 'function', foreground: '89b4fa' },
  ],
  colors: {
    'editor.background': '#1e1e2e',
    'editor.foreground': '#cdd6f4',
    'editorLineNumber.foreground': '#6c7086',
    'editorLineNumber.activeForeground': '#a6adc8',
    'editor.selectionBackground': '#89b4fa33',
    'editor.lineHighlightBackground': '#31324400',
    'editorGutter.background': '#1e1e2e',
    'diffEditor.insertedTextBackground': '#a6e3a133',
    'diffEditor.removedTextBackground': '#f38ba833',
    'diffEditor.insertedLineBackground': '#a6e3a118',
    'diffEditor.removedLineBackground': '#f38ba818',
  },
};

const rosePineTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6e6a86', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c4a7e7' },
    { token: 'string', foreground: 'f6c177' },
    { token: 'number', foreground: 'eb6f92' },
    { token: 'type', foreground: '9ccfd8' },
    { token: 'variable', foreground: 'e0def4' },
    { token: 'function', foreground: 'c4a7e7' },
  ],
  colors: {
    'editor.background': '#191724',
    'editor.foreground': '#e0def4',
    'editorLineNumber.foreground': '#6e6a86',
    'editorLineNumber.activeForeground': '#908caa',
    'editor.selectionBackground': '#c4a7e733',
    'editor.lineHighlightBackground': '#1f1d2e00',
    'editorGutter.background': '#191724',
    'diffEditor.insertedTextBackground': '#9ccfd833',
    'diffEditor.removedTextBackground': '#eb6f9233',
    'diffEditor.insertedLineBackground': '#9ccfd818',
    'diffEditor.removedLineBackground': '#eb6f9218',
  },
};

const MONACO_THEMES: Record<Exclude<ThemeId, 'system'>, MonacoThemeDef> = {
  'default-light': defaultLightTheme,
  'default-dark': defaultDarkTheme,
  kanagawa: kanagawaTheme,
  'catppuccin-mocha': catppuccinMochaTheme,
  'rose-pine': rosePineTheme,
};

/** Register all app themes with Monaco. Call once after Monaco is loaded. */
export function registerMonacoThemes(monacoInstance: typeof import('monaco-editor')) {
  for (const [id, def] of Object.entries(MONACO_THEMES)) {
    monacoInstance.editor.defineTheme(`labrat-${id}`, def);
  }
}
