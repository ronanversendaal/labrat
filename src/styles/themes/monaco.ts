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

const tokyoNightTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'bb9af7' },
    { token: 'string', foreground: '9ece6a' },
    { token: 'number', foreground: 'ff9e64' },
    { token: 'type', foreground: '2ac3de' },
    { token: 'variable', foreground: 'a9b1d6' },
    { token: 'function', foreground: '7aa2f7' },
  ],
  colors: {
    'editor.background': '#1a1b26',
    'editor.foreground': '#a9b1d6',
    'editorLineNumber.foreground': '#565f89',
    'editorLineNumber.activeForeground': '#9aa5ce',
    'editor.selectionBackground': '#7aa2f733',
    'editor.lineHighlightBackground': '#24283b00',
    'editorGutter.background': '#1a1b26',
    'diffEditor.insertedTextBackground': '#9ece6a33',
    'diffEditor.removedTextBackground': '#f7768e33',
    'diffEditor.insertedLineBackground': '#9ece6a18',
    'diffEditor.removedLineBackground': '#f7768e18',
  },
};

const nordTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '4c566a', fontStyle: 'italic' },
    { token: 'keyword', foreground: '81a1c1' },
    { token: 'string', foreground: 'a3be8c' },
    { token: 'number', foreground: 'b48ead' },
    { token: 'type', foreground: '8fbcbb' },
    { token: 'variable', foreground: 'd8dee9' },
    { token: 'function', foreground: '88c0d0' },
  ],
  colors: {
    'editor.background': '#2e3440',
    'editor.foreground': '#d8dee9',
    'editorLineNumber.foreground': '#4c566a',
    'editorLineNumber.activeForeground': '#d8dee9',
    'editor.selectionBackground': '#88c0d033',
    'editor.lineHighlightBackground': '#3b425200',
    'editorGutter.background': '#2e3440',
    'diffEditor.insertedTextBackground': '#a3be8c33',
    'diffEditor.removedTextBackground': '#bf616a33',
    'diffEditor.insertedLineBackground': '#a3be8c18',
    'diffEditor.removedLineBackground': '#bf616a18',
  },
};

const everforestDarkTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7a8478', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'e67e80' },
    { token: 'string', foreground: 'a7c080' },
    { token: 'number', foreground: 'd699b6' },
    { token: 'type', foreground: '7fbbb3' },
    { token: 'variable', foreground: 'd3c6aa' },
    { token: 'function', foreground: 'a7c080' },
  ],
  colors: {
    'editor.background': '#2d353b',
    'editor.foreground': '#d3c6aa',
    'editorLineNumber.foreground': '#7a8478',
    'editorLineNumber.activeForeground': '#9da9a0',
    'editor.selectionBackground': '#a7c08033',
    'editor.lineHighlightBackground': '#343f4400',
    'editorGutter.background': '#2d353b',
    'diffEditor.insertedTextBackground': '#83c09233',
    'diffEditor.removedTextBackground': '#e67e8033',
    'diffEditor.insertedLineBackground': '#83c09218',
    'diffEditor.removedLineBackground': '#e67e8018',
  },
};

const draculaTheme: MonacoThemeDef = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff79c6' },
    { token: 'string', foreground: 'f1fa8c' },
    { token: 'number', foreground: 'bd93f9' },
    { token: 'type', foreground: '8be9fd' },
    { token: 'variable', foreground: 'f8f8f2' },
    { token: 'function', foreground: '50fa7b' },
  ],
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#bfc5d4',
    'editor.selectionBackground': '#bd93f933',
    'editor.lineHighlightBackground': '#34374600',
    'editorGutter.background': '#282a36',
    'diffEditor.insertedTextBackground': '#50fa7b33',
    'diffEditor.removedTextBackground': '#ff555533',
    'diffEditor.insertedLineBackground': '#50fa7b18',
    'diffEditor.removedLineBackground': '#ff555518',
  },
};

const githubLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'cf222e' },
    { token: 'string', foreground: '0a3069' },
    { token: 'number', foreground: '0550ae' },
    { token: 'type', foreground: '0550ae' },
    { token: 'variable', foreground: '1f2328' },
    { token: 'function', foreground: '8250df' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f2328',
    'editorLineNumber.foreground': '#6a737d',
    'editorLineNumber.activeForeground': '#59636e',
    'editor.selectionBackground': '#0969da33',
    'editor.lineHighlightBackground': '#f6f8fa00',
    'editorGutter.background': '#f6f8fa',
    'diffEditor.insertedTextBackground': '#1a7f3733',
    'diffEditor.removedTextBackground': '#cf222e33',
    'diffEditor.insertedLineBackground': '#dafbe1',
    'diffEditor.removedLineBackground': '#ffebe9',
  },
};

const solarizedLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
    { token: 'keyword', foreground: '859900' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'type', foreground: '268bd2' },
    { token: 'variable', foreground: '657b83' },
    { token: 'function', foreground: '268bd2' },
  ],
  colors: {
    'editor.background': '#fdf6e3',
    'editor.foreground': '#657b83',
    'editorLineNumber.foreground': '#93a1a1',
    'editorLineNumber.activeForeground': '#586e75',
    'editor.selectionBackground': '#268bd233',
    'editor.lineHighlightBackground': '#eee8d500',
    'editorGutter.background': '#eee8d5',
    'diffEditor.insertedTextBackground': '#85990033',
    'diffEditor.removedTextBackground': '#dc322f33',
    'diffEditor.insertedLineBackground': '#85990018',
    'diffEditor.removedLineBackground': '#dc322f18',
  },
};

const gruvboxLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '928374', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9d0006' },
    { token: 'string', foreground: '79740e' },
    { token: 'number', foreground: '8f3f71' },
    { token: 'type', foreground: '076678' },
    { token: 'variable', foreground: '3c3836' },
    { token: 'function', foreground: '427b58' },
  ],
  colors: {
    'editor.background': '#fbf1c7',
    'editor.foreground': '#3c3836',
    'editorLineNumber.foreground': '#928374',
    'editorLineNumber.activeForeground': '#504945',
    'editor.selectionBackground': '#d65d0e33',
    'editor.lineHighlightBackground': '#ebdbb200',
    'editorGutter.background': '#ebdbb2',
    'diffEditor.insertedTextBackground': '#79740e33',
    'diffEditor.removedTextBackground': '#9d000633',
    'diffEditor.insertedLineBackground': '#79740e18',
    'diffEditor.removedLineBackground': '#9d000618',
  },
};

const everforestLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '939f91', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'f85552' },
    { token: 'string', foreground: '8da101' },
    { token: 'number', foreground: 'df69ba' },
    { token: 'type', foreground: '3a94c5' },
    { token: 'variable', foreground: '5c6a72' },
    { token: 'function', foreground: '35a77c' },
  ],
  colors: {
    'editor.background': '#fdf6e3',
    'editor.foreground': '#5c6a72',
    'editorLineNumber.foreground': '#939f91',
    'editorLineNumber.activeForeground': '#708089',
    'editor.selectionBackground': '#8da10133',
    'editor.lineHighlightBackground': '#efebd400',
    'editorGutter.background': '#efebd4',
    'diffEditor.insertedTextBackground': '#35a77c33',
    'diffEditor.removedTextBackground': '#f8555233',
    'diffEditor.insertedLineBackground': '#35a77c18',
    'diffEditor.removedLineBackground': '#f8555218',
  },
};

const catppuccinLatteTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8c8fa1', fontStyle: 'italic' },
    { token: 'keyword', foreground: '8839ef' },
    { token: 'string', foreground: '40a02b' },
    { token: 'number', foreground: 'fe640b' },
    { token: 'type', foreground: '1e66f5' },
    { token: 'variable', foreground: '4c4f69' },
    { token: 'function', foreground: '1e66f5' },
  ],
  colors: {
    'editor.background': '#eff1f5',
    'editor.foreground': '#4c4f69',
    'editorLineNumber.foreground': '#8c8fa1',
    'editorLineNumber.activeForeground': '#5c5f77',
    'editor.selectionBackground': '#1e66f533',
    'editor.lineHighlightBackground': '#e6e9ef00',
    'editorGutter.background': '#e6e9ef',
    'diffEditor.insertedTextBackground': '#40a02b33',
    'diffEditor.removedTextBackground': '#d20f3933',
    'diffEditor.insertedLineBackground': '#40a02b18',
    'diffEditor.removedLineBackground': '#d20f3918',
  },
};

const rosePineDawnTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9893a5', fontStyle: 'italic' },
    { token: 'keyword', foreground: '907aa9' },
    { token: 'string', foreground: 'ea9d34' },
    { token: 'number', foreground: 'b4637a' },
    { token: 'type', foreground: '56949f' },
    { token: 'variable', foreground: '575279' },
    { token: 'function', foreground: '286983' },
  ],
  colors: {
    'editor.background': '#faf4ed',
    'editor.foreground': '#575279',
    'editorLineNumber.foreground': '#9893a5',
    'editorLineNumber.activeForeground': '#6e6a86',
    'editor.selectionBackground': '#907aa933',
    'editor.lineHighlightBackground': '#f2e9e100',
    'editorGutter.background': '#f2e9e1',
    'diffEditor.insertedTextBackground': '#28698333',
    'diffEditor.removedTextBackground': '#b4637a33',
    'diffEditor.insertedLineBackground': '#28698318',
    'diffEditor.removedLineBackground': '#b4637a18',
  },
};

const oneLightTheme: MonacoThemeDef = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'a0a1a7', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a626a4' },
    { token: 'string', foreground: '50a14f' },
    { token: 'number', foreground: '986801' },
    { token: 'type', foreground: 'c18401' },
    { token: 'variable', foreground: '383a42' },
    { token: 'function', foreground: '4078f2' },
  ],
  colors: {
    'editor.background': '#fafafa',
    'editor.foreground': '#383a42',
    'editorLineNumber.foreground': '#a0a1a7',
    'editorLineNumber.activeForeground': '#696c77',
    'editor.selectionBackground': '#4078f233',
    'editor.lineHighlightBackground': '#f0f0f000',
    'editorGutter.background': '#f0f0f0',
    'diffEditor.insertedTextBackground': '#50a14f33',
    'diffEditor.removedTextBackground': '#e4564933',
    'diffEditor.insertedLineBackground': '#e2f3e2',
    'diffEditor.removedLineBackground': '#fae5e4',
  },
};

const MONACO_THEMES: Record<Exclude<ThemeId, 'system'>, MonacoThemeDef> = {
  'default-light': defaultLightTheme,
  'default-dark': defaultDarkTheme,
  kanagawa: kanagawaTheme,
  'catppuccin-mocha': catppuccinMochaTheme,
  'rose-pine': rosePineTheme,
  'tokyo-night': tokyoNightTheme,
  nord: nordTheme,
  'everforest-dark': everforestDarkTheme,
  dracula: draculaTheme,
  'github-light': githubLightTheme,
  'solarized-light': solarizedLightTheme,
  'gruvbox-light': gruvboxLightTheme,
  'everforest-light': everforestLightTheme,
  'catppuccin-latte': catppuccinLatteTheme,
  'rose-pine-dawn': rosePineDawnTheme,
  'one-light': oneLightTheme,
};

/** Register all app themes with Monaco. Call once after Monaco is loaded. */
export function registerMonacoThemes(monacoInstance: typeof import('monaco-editor')) {
  for (const [id, def] of Object.entries(MONACO_THEMES)) {
    monacoInstance.editor.defineTheme(`labrat-${id}`, def);
  }
}
