/**
 * MonacoDiffView - Monaco Editor-based diff viewer
 * Provides syntax highlighting, side-by-side/inline views, and advanced diff features
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { DiffEditor, useMonaco } from '@monaco-editor/react';
import type { DiffFile } from '../../types';
import { useUIStore } from '../../stores';
import type * as Monaco from 'monaco-editor';

interface MonacoDiffViewProps {
  file: DiffFile;
  onNextFile?: () => void;
  onPrevFile?: () => void;
  targetLine?: number;
}

// Map file extensions to Monaco language identifiers
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',
    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    // Data formats
    json: 'json',
    jsonc: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    toml: 'ini',
    // Programming languages
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    hxx: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    php: 'php',
    pl: 'perl',
    lua: 'lua',
    r: 'r',
    // Shell
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    // Config
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    // Markup
    md: 'markdown',
    markdown: 'markdown',
    rst: 'restructuredtext',
    tex: 'latex',
    // SQL
    sql: 'sql',
    // GraphQL
    graphql: 'graphql',
    gql: 'graphql',
    // Other
    vue: 'vue',
    svelte: 'html',
  };

  // Handle special filenames
  const filename = path.split('/').pop()?.toLowerCase() || '';
  if (filename === 'dockerfile') return 'dockerfile';
  if (filename === 'makefile' || filename === 'gnumakefile') return 'makefile';
  if (filename.endsWith('.d.ts')) return 'typescript';

  return languageMap[ext] || 'plaintext';
}

// Parse diff to extract original and modified content
function parseDiffContent(diff: string): { original: string; modified: string } {
  const lines = diff.split('\n');
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const line of lines) {
    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }
    // Skip hunk headers
    if (line.startsWith('@@')) {
      continue;
    }
    // Deletion - only in original
    if (line.startsWith('-')) {
      originalLines.push(line.slice(1));
    }
    // Addition - only in modified
    else if (line.startsWith('+')) {
      modifiedLines.push(line.slice(1));
    }
    // Context - in both
    else if (line.startsWith(' ')) {
      originalLines.push(line.slice(1));
      modifiedLines.push(line.slice(1));
    }
    // No prefix - treat as context
    else if (line.length > 0) {
      originalLines.push(line);
      modifiedLines.push(line);
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n'),
  };
}

export function MonacoDiffView({ file, onNextFile, onPrevFile, targetLine }: MonacoDiffViewProps) {
  const { diffViewMode, setDiffViewMode, showWhitespace, toggleWhitespace } = useUIStore();
  const monaco = useMonaco();
  const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>('vs-dark');

  // Detect system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'vs-dark' : 'vs');

    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'vs-dark' : 'vs');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Parse diff content
  const { original, modified } = useMemo(() => parseDiffContent(file.diff), [file.diff]);
  const language = useMemo(() => getLanguageFromPath(file.new_path || file.old_path), [file.new_path, file.old_path]);

  // Configure Monaco when available
  useEffect(() => {
    if (monaco) {
      // Configure diff editor defaults
      monaco.editor.defineTheme('gitlab-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'diffEditor.insertedTextBackground': '#23863633',
          'diffEditor.removedTextBackground': '#da363333',
          'diffEditor.insertedLineBackground': '#23863622',
          'diffEditor.removedLineBackground': '#da363322',
        },
      });
      monaco.editor.defineTheme('gitlab-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'diffEditor.insertedTextBackground': '#23863633',
          'diffEditor.removedTextBackground': '#da363333',
          'diffEditor.insertedLineBackground': '#dafbe1',
          'diffEditor.removedLineBackground': '#ffebe9',
        },
      });
    }
  }, [monaco]);

  // Scroll to target line when it changes
  useEffect(() => {
    if (targetLine && editorRef.current) {
      const modifiedEditor = editorRef.current.getModifiedEditor();
      modifiedEditor.revealLineInCenter(targetLine);
      modifiedEditor.setSelection({
        startLineNumber: targetLine,
        startColumn: 1,
        endLineNumber: targetLine,
        endColumn: 1000,
      });
    }
  }, [targetLine]);

  const handleEditorMount = (editor: Monaco.editor.IStandaloneDiffEditor) => {
    editorRef.current = editor;
  };

  const editorOptions: Monaco.editor.IDiffEditorConstructionOptions = {
    readOnly: true,
    renderSideBySide: diffViewMode === 'split',
    renderWhitespace: showWhitespace ? 'all' : 'none',
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    folding: true,
    wordWrap: 'off',
    automaticLayout: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
    renderIndicators: true,
    originalEditable: false,
    ignoreTrimWhitespace: !showWhitespace,
    renderOverviewRuler: true,
    diffWordWrap: 'off',
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <FileStatusBadge file={file} />
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate">
            {file.renamed_file ? `${file.old_path} → ${file.new_path}` : file.new_path}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <span className="text-xs text-green-600 dark:text-green-400">+{file.additions}</span>
          <span className="text-xs text-red-600 dark:text-red-400">-{file.deletions}</span>

          {/* View mode toggle */}
          <div className="flex items-center ml-4 border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-1 text-xs ${
                diffViewMode === 'unified'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Inline
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-1 text-xs ${
                diffViewMode === 'split'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          {/* Whitespace toggle */}
          <button
            onClick={toggleWhitespace}
            className={`px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded ${
              showWhitespace
                ? 'bg-gray-200 dark:bg-gray-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={showWhitespace ? 'Hide whitespace' : 'Show whitespace'}
          >
            ⎵
          </button>

          {/* Navigation */}
          {(onPrevFile || onNextFile) && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={onPrevFile}
                disabled={!onPrevFile}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
                title="Previous file (k)"
              >
                <ChevronUpIcon />
              </button>
              <button
                onClick={onNextFile}
                disabled={!onNextFile}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
                title="Next file (j)"
              >
                <ChevronDownIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Monaco Diff Editor */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          original={original}
          modified={modified}
          language={language}
          theme={theme === 'vs-dark' ? 'gitlab-dark' : 'gitlab-light'}
          options={editorOptions}
          onMount={handleEditorMount}
          loading={<DiffLoading />}
        />
      </div>
    </div>
  );
}

function DiffLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading diff editor...</span>
      </div>
    </div>
  );
}

function FileStatusBadge({ file }: { file: DiffFile }) {
  if (file.new_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">Added</span>;
  }
  if (file.deleted_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">Deleted</span>;
  }
  if (file.renamed_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">Renamed</span>;
  }
  return <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">Modified</span>;
}

function ChevronUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
