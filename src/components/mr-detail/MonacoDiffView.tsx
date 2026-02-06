/**
 * MonacoDiffView - Monaco Editor-based diff viewer
 * Provides syntax highlighting, side-by-side/inline views, and advanced diff features
 * Now with inline comment threads using Monaco View Zones
 */

import { useRef, useEffect, useState, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { DiffEditor, useMonaco } from '@monaco-editor/react';
import type { DiffFile, Discussion, CommentPosition, Author } from '../../types';
import { useUIStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFileContent } from '../../hooks/useGitLab';
import { useFocusStore } from '../../hooks/useFocusManager';
import { InlineCommentOverlay, InlineCommentThread, SuggestionEditor } from '../comments';
import { Avatar } from '../common';
import type * as Monaco from 'monaco-editor';

export interface MonacoDiffViewHandle {
  scrollDown: () => void;
  scrollUp: () => void;
  enterLineNavMode: () => void;
  exitLineNavMode: () => void;
}

interface MonacoDiffViewProps {
  file: DiffFile;
  onNextFile?: () => void;
  onPrevFile?: () => void;
  targetLine?: number;
  /** Project ID for inline comments */
  projectId?: number;
  /** MR IID for inline comments */
  mrIid?: number;
  /** Discussions to show inline */
  discussions?: Discussion[];
  /** Base SHA for comment position */
  baseSha?: string;
  /** Head SHA for comment position */
  headSha?: string;
  /** Callback when discussions change */
  onDiscussionsChange?: () => void;
  /** MR Author for showing Owner badge */
  mrAuthor?: Author;
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

// Check if a discussion is resolved
function isDiscussionResolved(discussion: Discussion): boolean {
  return discussion.notes.every((n) => !n.resolvable || n.resolved);
}

// Get discussions for a specific file
function getFileDiscussions(discussions: Discussion[] | undefined, filePath: string): Discussion[] {
  if (!discussions) return [];
  return discussions.filter((d) => {
    const firstNote = d.notes[0];
    if (!firstNote?.position) return false;
    return firstNote.position.new_path === filePath;
  });
}

// Group discussions by line number
function groupDiscussionsByLine(discussions: Discussion[]): Map<number, Discussion[]> {
  const grouped = new Map<number, Discussion[]>();
  for (const discussion of discussions) {
    const line = discussion.notes[0]?.position?.new_line;
    if (line) {
      const existing = grouped.get(line) || [];
      existing.push(discussion);
      grouped.set(line, existing);
    }
  }
  return grouped;
}

export const MonacoDiffView = forwardRef<MonacoDiffViewHandle, MonacoDiffViewProps>(function MonacoDiffView(
  { file, onNextFile, onPrevFile, targetLine, projectId, mrIid, discussions, baseSha, headSha, onDiscussionsChange, mrAuthor },
  ref
) {
  const { diffViewMode, setDiffViewMode, showWhitespace, toggleWhitespace, wordWrap, toggleWordWrap, expandedResolvedThreads, toggleResolvedThread } = useUIStore();
  const appTheme = useSettingsStore((state) => state.theme);
  const monaco = useMonaco();
  const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>('vs-dark');
  const [editorReady, setEditorReady] = useState(false);

  // Resolved thread indicators (avatar positions in gutter)
  const [resolvedIndicators, setResolvedIndicators] = useState<Array<{
    discussionId: string;
    lineNumber: number;
    avatarUrl: string | null;
    authorName: string;
    top: number;
    left: number;
  }>>([]);

  // View zone containers for inline threads (DOM nodes that portals render into)
  const [viewZoneContainers, setViewZoneContainers] = useState<Array<{
    lineNumber: number;
    discussions: Discussion[];
    domNode: HTMLDivElement;
    zoneId: string;
  }>>([]);

  // Track view zone IDs for cleanup
  const viewZoneIdsRef = useRef<string[]>([]);

  // Inline comment state for new comments
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [glyphPosition, setGlyphPosition] = useState<{ top: number; left: number } | null>(null);
  const activeCommentLineRef = useRef<number | null>(null);
  // View zone container for the comment form
  const [commentViewZoneContainer, setCommentViewZoneContainer] = useState<{ domNode: HTMLDivElement; zoneId: string } | null>(null);
  const commentViewZoneIdRef = useRef<string | null>(null);
  // Suggestion editor state
  const [activeSuggestionLine, setActiveSuggestionLine] = useState<number | null>(null);
  const [suggestionViewZoneContainer, setSuggestionViewZoneContainer] = useState<{ domNode: HTMLDivElement; zoneId: string } | null>(null);
  const suggestionViewZoneIdRef = useRef<string | null>(null);
  const isHoveringButtonRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    activeCommentLineRef.current = activeCommentLine;
  }, [activeCommentLine]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Create view zone for inline comment form (pushes code down, scrolls with content)
  useEffect(() => {
    const editor = editorRef.current;
    if (!activeCommentLine || !editor || !monaco || !editorReady) {
      // Clean up existing comment view zone
      if (commentViewZoneIdRef.current && editor) {
        const zoneId = commentViewZoneIdRef.current;
        editor.getModifiedEditor().changeViewZones((accessor) => {
          accessor.removeZone(zoneId);
        });
        commentViewZoneIdRef.current = null;
      }
      setCommentViewZoneContainer(null);
      return;
    }

    const modifiedEditor = editor.getModifiedEditor();

    // Add highlight decoration to the active line
    const decorationCollection = modifiedEditor.createDecorationsCollection([
      {
        range: new monaco.Range(activeCommentLine, 1, activeCommentLine, 1),
        options: {
          isWholeLine: true,
          className: 'comment-active-line',
          glyphMarginClassName: 'comment-active-glyph',
        },
      },
    ]);

    // Create view zone DOM node
    const domNode = document.createElement('div');
    domNode.className = 'monaco-view-zone-comment';
    domNode.style.boxSizing = 'border-box';
    // Stop mouse events from reaching Monaco (prevents code selection, keeps button clicks working)
    domNode.addEventListener('mousedown', (e) => e.stopPropagation());
    domNode.addEventListener('mouseup', (e) => e.stopPropagation());
    domNode.addEventListener('click', (e) => e.stopPropagation());

    let resizeObserver: ResizeObserver | null = null;

    modifiedEditor.changeViewZones((accessor) => {
      // Remove old zone if any
      if (commentViewZoneIdRef.current) {
        accessor.removeZone(commentViewZoneIdRef.current);
      }

      const zoneId = accessor.addZone({
        afterLineNumber: activeCommentLine,
        heightInPx: 280,
        domNode,
        suppressMouseDown: false,
      });

      commentViewZoneIdRef.current = zoneId;
      setCommentViewZoneContainer({ domNode, zoneId });

      // Observe content size changes - use parent height hack (same as thread view zones)
      // Do NOT mutate heightInPx + layoutZone as that creates a feedback loop
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = Math.ceil(entry.contentRect.height) + 16;
          if (newHeight > 50) {
            modifiedEditor.changeViewZones((acc) => {
              acc.layoutZone(zoneId);
            });
            (domNode.parentElement as HTMLElement | null)?.style.setProperty('height', `${newHeight}px`);
          }
        }
      });
      resizeObserver.observe(domNode);
    });

    // Scroll to reveal the line
    modifiedEditor.revealLineInCenter(activeCommentLine);

    return () => {
      resizeObserver?.disconnect();
      decorationCollection.clear();
      if (commentViewZoneIdRef.current) {
        const zoneId = commentViewZoneIdRef.current;
        modifiedEditor.changeViewZones((accessor) => {
          accessor.removeZone(zoneId);
        });
        commentViewZoneIdRef.current = null;
      }
      setCommentViewZoneContainer(null);
    };
  }, [activeCommentLine, monaco, editorReady]);

  // Create view zone for suggestion editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!activeSuggestionLine || !editor || !monaco || !editorReady) {
      // Clean up existing suggestion view zone
      if (suggestionViewZoneIdRef.current && editor) {
        const zoneId = suggestionViewZoneIdRef.current;
        editor.getModifiedEditor().changeViewZones((accessor) => {
          accessor.removeZone(zoneId);
        });
        suggestionViewZoneIdRef.current = null;
      }
      setSuggestionViewZoneContainer(null);
      return;
    }

    const modifiedEditor = editor.getModifiedEditor();

    const domNode = document.createElement('div');
    domNode.className = 'monaco-view-zone-comment';
    domNode.style.boxSizing = 'border-box';
    domNode.addEventListener('mousedown', (e) => e.stopPropagation());
    domNode.addEventListener('mouseup', (e) => e.stopPropagation());
    domNode.addEventListener('click', (e) => e.stopPropagation());

    let resizeObserver: ResizeObserver | null = null;

    modifiedEditor.changeViewZones((accessor) => {
      if (suggestionViewZoneIdRef.current) {
        accessor.removeZone(suggestionViewZoneIdRef.current);
      }

      const zoneId = accessor.addZone({
        afterLineNumber: activeSuggestionLine,
        heightInPx: 200,
        domNode,
        suppressMouseDown: false,
      });

      suggestionViewZoneIdRef.current = zoneId;
      setSuggestionViewZoneContainer({ domNode, zoneId });

      // Observe content size changes - use parent height hack (same as thread view zones)
      // Do NOT mutate heightInPx + layoutZone as that creates a feedback loop
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = Math.ceil(entry.contentRect.height) + 16;
          if (newHeight > 50) {
            modifiedEditor.changeViewZones((acc) => {
              acc.layoutZone(zoneId);
            });
            (domNode.parentElement as HTMLElement | null)?.style.setProperty('height', `${newHeight}px`);
          }
        }
      });
      resizeObserver.observe(domNode);
    });

    modifiedEditor.revealLineInCenter(activeSuggestionLine);

    return () => {
      resizeObserver?.disconnect();
      if (suggestionViewZoneIdRef.current) {
        const zoneId = suggestionViewZoneIdRef.current;
        modifiedEditor.changeViewZones((accessor) => {
          accessor.removeZone(zoneId);
        });
        suggestionViewZoneIdRef.current = null;
      }
      setSuggestionViewZoneContainer(null);
    };
  }, [activeSuggestionLine, monaco, editorReady]);

  // Track the line we came from before opening comment/suggest (for restore on close)
  const preCommentLineRef = useRef<number | null>(null);

  // Track if inline comments are enabled (need project info)
  const inlineCommentsEnabled = !!projectId && !!mrIid && !!baseSha && !!headSha;

  // Focus store for line navigation
  const { currentZone, diffMode, focusedLine, setFocusZone, setDiffMode, setFocusedLine } = useFocusStore();

  // Get total line count for the modified editor
  const getModifiedLineCount = useCallback(() => {
    const editor = editorRef.current?.getModifiedEditor();
    if (!editor) return 0;
    return editor.getModel()?.getLineCount() || 0;
  }, []);

  // Move focused line up
  const moveFocusedLineUp = useCallback(() => {
    if (currentZone !== 'diff' || diffMode !== 'line-nav') return;
    const newLine = Math.max(1, (focusedLine || 1) - 1);
    setFocusedLine(newLine);
    editorRef.current?.getModifiedEditor().revealLineInCenterIfOutsideViewport(newLine);
  }, [currentZone, diffMode, focusedLine, setFocusedLine]);

  // Move focused line down
  const moveFocusedLineDown = useCallback(() => {
    if (currentZone !== 'diff' || diffMode !== 'line-nav') return;
    const maxLine = getModifiedLineCount();
    const newLine = Math.min(maxLine, (focusedLine || 0) + 1);
    setFocusedLine(newLine);
    editorRef.current?.getModifiedEditor().revealLineInCenterIfOutsideViewport(newLine);
  }, [currentZone, diffMode, focusedLine, setFocusedLine, getModifiedLineCount]);

  // Enter line-nav mode: initialize focusedLine to first visible line
  const enterLineNavMode = useCallback(() => {
    const editor = editorRef.current?.getModifiedEditor();
    if (!editor) return;
    const visibleRanges = editor.getVisibleRanges();
    const firstVisibleLine = visibleRanges[0]?.startLineNumber || 1;
    setFocusedLine(firstVisibleLine);
  }, [setFocusedLine]);

  // Exit line-nav mode
  const exitLineNavMode = useCallback(() => {
    setFocusedLine(null);
  }, [setFocusedLine]);

  // Focused line decoration
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !editorReady || focusedLine === null || diffMode !== 'line-nav') return;

    const modifiedEditor = editor.getModifiedEditor();
    const decorationCollection = modifiedEditor.createDecorationsCollection([
      {
        range: new monaco.Range(focusedLine, 1, focusedLine, 1),
        options: {
          isWholeLine: true,
          className: 'focused-line-cursor',
        },
      },
    ]);

    return () => {
      decorationCollection.clear();
    };
  }, [focusedLine, diffMode, monaco, editorReady]);

  // Handle keyboard events in line-nav mode (j/k/c/s)
  useEffect(() => {
    if (currentZone !== 'diff' || diffMode !== 'line-nav') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocusedLineDown();
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocusedLineUp();
      } else if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Open comment on focused line
        e.preventDefault();
        if (focusedLine && inlineCommentsEnabled) {
          preCommentLineRef.current = focusedLine;
          setActiveCommentLine(focusedLine);
          setDiffMode('comment');
        }
      } else if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Open suggestion editor on focused line
        e.preventDefault();
        if (focusedLine && inlineCommentsEnabled) {
          preCommentLineRef.current = focusedLine;
          setActiveSuggestionLine(focusedLine);
          setDiffMode('suggest');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentZone, diffMode, focusedLine, inlineCommentsEnabled, moveFocusedLineDown, moveFocusedLineUp, setDiffMode]);

  // Handle click inside editor: enter line-nav and set focused line
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !editorReady) return;

    const modifiedEditor = editor.getModifiedEditor();
    const disposable = modifiedEditor.onMouseDown((e) => {
      // Only on content clicks, not gutter
      const contentTargets = [
        monaco.editor.MouseTargetType.CONTENT_TEXT,
        monaco.editor.MouseTargetType.CONTENT_EMPTY,
      ];
      if (contentTargets.includes(e.target.type) && e.target.position) {
        setFocusZone('diff');
        setDiffMode('line-nav');
        setFocusedLine(e.target.position.lineNumber);
      }
    });

    return () => disposable.dispose();
  }, [monaco, editorReady, setFocusZone, setDiffMode, setFocusedLine]);

  // Scroll down half a page
  const scrollDown = useCallback(() => {
    const editor = editorRef.current?.getModifiedEditor();
    if (!editor) return;

    const visibleRanges = editor.getVisibleRanges();
    if (visibleRanges.length === 0) return;

    const visibleLines = visibleRanges[0].endLineNumber - visibleRanges[0].startLineNumber;
    const scrollAmount = Math.max(1, Math.floor(visibleLines / 2));
    const currentTop = editor.getScrollTop();
    const lineHeight = (editor.getOption(monaco?.editor.EditorOption.lineHeight ?? 66) as number) || 20;

    editor.setScrollTop(currentTop + scrollAmount * lineHeight);
  }, [monaco]);

  // Scroll up half a page
  const scrollUp = useCallback(() => {
    const editor = editorRef.current?.getModifiedEditor();
    if (!editor) return;

    const visibleRanges = editor.getVisibleRanges();
    if (visibleRanges.length === 0) return;

    const visibleLines = visibleRanges[0].endLineNumber - visibleRanges[0].startLineNumber;
    const scrollAmount = Math.max(1, Math.floor(visibleLines / 2));
    const currentTop = editor.getScrollTop();
    const lineHeight = (editor.getOption(monaco?.editor.EditorOption.lineHeight ?? 66) as number) || 20;

    editor.setScrollTop(Math.max(0, currentTop - scrollAmount * lineHeight));
  }, [monaco]);

  // Expose scroll functions via ref for parent component
  useImperativeHandle(ref, () => ({
    scrollDown,
    scrollUp,
    enterLineNavMode,
    exitLineNavMode,
  }), [scrollDown, scrollUp, enterLineNavMode, exitLineNavMode]);

  // Sync Monaco theme with app theme setting
  useEffect(() => {
    const updateTheme = (isDark: boolean) => {
      setTheme(isDark ? 'vs-dark' : 'vs');
    };

    if (appTheme === 'system') {
      // Use system preference when theme is set to 'system'
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      updateTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => updateTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Use explicit theme setting
      updateTheme(appTheme === 'dark');
    }
  }, [appTheme]);

  // Fetch full file content for proper syntax highlighting
  const oldFilePath = file.old_path || file.new_path;
  const newFilePath = file.new_path || file.old_path;

  const { data: fullOriginal, isLoading: isLoadingOriginal } = useFileContent(
    projectId ?? 0,
    oldFilePath,
    !file.new_file && baseSha ? baseSha : ''
  );
  const { data: fullModified, isLoading: isLoadingModified } = useFileContent(
    projectId ?? 0,
    newFilePath,
    !file.deleted_file && headSha ? headSha : ''
  );

  // Parse diff as fallback
  const diffParsed = useMemo(() => parseDiffContent(file.diff), [file.diff]);

  // Use full file content when available, fall back to parsed diff
  const useFullFiles = fullOriginal !== undefined || fullModified !== undefined;
  const original = file.new_file ? '' : (fullOriginal ?? diffParsed.original);
  const modified = file.deleted_file ? '' : (fullModified ?? diffParsed.modified);

  const language = useMemo(() => getLanguageFromPath(file.new_path || file.old_path), [file.new_path, file.old_path]);

  // Get discussions for this file
  const fileDiscussions = useMemo(
    () => getFileDiscussions(discussions, file.new_path),
    [discussions, file.new_path]
  );

  // Group discussions by line
  const discussionsByLine = useMemo(
    () => groupDiscussionsByLine(fileDiscussions),
    [fileDiscussions]
  );

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

  // Handle opening a new comment on a line
  const handleOpenComment = useCallback((lineNumber: number) => {
    preCommentLineRef.current = focusedLine;
    setActiveCommentLine(lineNumber);
    setDiffMode('comment');
  }, [focusedLine, setDiffMode]);

  // Handle closing the comment overlay - restore cursor to the comment line
  const handleCloseComment = useCallback(() => {
    const restoreLine = activeCommentLineRef.current ?? preCommentLineRef.current;
    setActiveCommentLine(null);
    if (currentZone === 'diff') {
      setDiffMode('line-nav');
      if (restoreLine !== null) {
        setFocusedLine(restoreLine);
      }
    }
  }, [currentZone, setDiffMode, setFocusedLine]);

  // Handle successful comment/reply - restore cursor to the comment line
  const handleCommentSuccess = useCallback(() => {
    const restoreLine = activeCommentLineRef.current ?? preCommentLineRef.current;
    setActiveCommentLine(null);
    onDiscussionsChange?.();
    if (currentZone === 'diff') {
      setDiffMode('line-nav');
      if (restoreLine !== null) {
        setFocusedLine(restoreLine);
      }
    }
  }, [onDiscussionsChange, currentZone, setDiffMode, setFocusedLine]);

  // Handle closing the suggestion editor - restore cursor to the suggestion line
  const handleCloseSuggestion = useCallback(() => {
    const restoreLine = preCommentLineRef.current;
    setActiveSuggestionLine(null);
    if (currentZone === 'diff') {
      setDiffMode('line-nav');
      if (restoreLine !== null) {
        setFocusedLine(restoreLine);
      }
    }
  }, [currentZone, setDiffMode, setFocusedLine]);

  // Handle suggestion submit success - restore cursor to the suggestion line
  const handleSuggestionSuccess = useCallback(() => {
    const restoreLine = preCommentLineRef.current;
    setActiveSuggestionLine(null);
    onDiscussionsChange?.();
    if (currentZone === 'diff') {
      setDiffMode('line-nav');
      if (restoreLine !== null) {
        setFocusedLine(restoreLine);
      }
    }
  }, [onDiscussionsChange, currentZone, setDiffMode, setFocusedLine]);

  // Get discussions for the current file on a specific line
  const getDiscussionsForLine = useCallback((lineNumber: number) => {
    return discussionsByLine.get(lineNumber) || [];
  }, [discussionsByLine]);

  // Build comment position for a line
  const buildCommentPosition = useCallback((lineNumber: number): CommentPosition | null => {
    if (!baseSha || !headSha) return null;
    return {
      base_sha: baseSha,
      head_sha: headSha,
      old_path: file.old_path !== file.new_path ? file.old_path : undefined,
      new_path: file.new_path,
      new_line: lineNumber,
      position_type: 'text',
    };
  }, [baseSha, headSha, file.old_path, file.new_path]);

  // Get original code for a line (for suggestions)
  const getLineContent = useCallback((lineNumber: number): string => {
    const lines = modified.split('\n');
    return lines[lineNumber - 1] || '';
  }, [modified]);

  // Create view zones for inline threads (pushes code down)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !inlineCommentsEnabled || !editorReady) return;

    const modifiedEditor = editor.getModifiedEditor();

    // Collect discussions that should be shown inline
    const visibleThreads: Array<{ lineNumber: number; discussions: Discussion[] }> = [];

    discussionsByLine.forEach((lineDiscussions, lineNumber) => {
      const visibleDiscussions = lineDiscussions.filter((d) => {
        const resolved = isDiscussionResolved(d);
        return !resolved || expandedResolvedThreads.has(d.id);
      });

      if (visibleDiscussions.length > 0) {
        visibleThreads.push({ lineNumber, discussions: visibleDiscussions });
      }
    });

    // Clear existing view zones and create new ones
    const newContainers: typeof viewZoneContainers = [];
    const resizeObservers: ResizeObserver[] = [];

    modifiedEditor.changeViewZones((accessor) => {
      // Remove old view zones
      viewZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
      viewZoneIdsRef.current = [];

      // Create new view zones
      visibleThreads.forEach(({ lineNumber, discussions }) => {
        const domNode = document.createElement('div');
        domNode.className = 'monaco-view-zone-thread';
        domNode.style.paddingLeft = '50px';
        domNode.style.paddingRight = '20px';
        domNode.style.boxSizing = 'border-box';

        const zoneId = accessor.addZone({
          afterLineNumber: lineNumber,
          heightInPx: 200, // Initial height
          domNode,
          suppressMouseDown: false,
          onDomNodeTop: () => {},
          onComputedHeight: () => {},
        });

        // Observe content size changes to update view zone height
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const height = entry.contentRect.height + 16; // Add padding
            if (height > 50) {
              modifiedEditor.changeViewZones((acc) => {
                // Update the zone height
                acc.layoutZone(zoneId);
              });
              // Directly update the zone's height
              (domNode.parentElement as HTMLElement | null)?.style.setProperty('height', `${height}px`);
            }
          }
        });
        resizeObserver.observe(domNode);
        resizeObservers.push(resizeObserver);

        viewZoneIdsRef.current.push(zoneId);
        newContainers.push({
          lineNumber,
          discussions,
          domNode,
          zoneId,
        });
      });
    });

    setViewZoneContainers(newContainers);

    // Cleanup on unmount
    return () => {
      resizeObservers.forEach((observer) => observer.disconnect());
      modifiedEditor.changeViewZones((accessor) => {
        viewZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
      });
      viewZoneIdsRef.current = [];
    };
  }, [monaco, discussionsByLine, expandedResolvedThreads, inlineCommentsEnabled, editorReady]);

  // Update line decorations for lines with open comments
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !inlineCommentsEnabled || !editorReady) return;

    const modifiedEditor = editor.getModifiedEditor();

    // Create decorations only for lines with open (unresolved) comments
    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];

    discussionsByLine.forEach((lineDiscussions, lineNumber) => {
      const hasOpenThread = lineDiscussions.some((d) => !isDiscussionResolved(d));

      if (hasOpenThread) {
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'has-comment-line',
          },
        });
      }
    });

    const decorationCollection = modifiedEditor.createDecorationsCollection(decorations);

    return () => {
      decorationCollection.clear();
    };
  }, [monaco, discussionsByLine, inlineCommentsEnabled, editorReady]);

  // Calculate positions for resolved thread avatar indicators
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !inlineCommentsEnabled || !editorReady) return;

    const modifiedEditor = editor.getModifiedEditor();
    const editorDom = modifiedEditor.getDomNode();
    if (!editorDom) return;

    const updateIndicatorPositions = () => {
      const newIndicators: typeof resolvedIndicators = [];
      const rect = editorDom.getBoundingClientRect();
      const scrollTop = modifiedEditor.getScrollTop();
      const lineHeight = modifiedEditor.getOption(monaco.editor.EditorOption.lineHeight) || 20;

      discussionsByLine.forEach((lineDiscussions, lineNumber) => {
        // Only show avatar for resolved threads that are NOT expanded
        const resolvedDiscussions = lineDiscussions.filter(
          (d) => isDiscussionResolved(d) && !expandedResolvedThreads.has(d.id)
        );

        if (resolvedDiscussions.length > 0) {
          const firstNote = resolvedDiscussions[0].notes[0];
          if (firstNote) {
            const lineTop = modifiedEditor.getTopForLineNumber(lineNumber);
            newIndicators.push({
              discussionId: resolvedDiscussions[0].id,
              lineNumber,
              avatarUrl: firstNote.author.avatar_url,
              authorName: firstNote.author.name,
              top: rect.top + lineTop - scrollTop + (lineHeight / 2) - 10,
              left: rect.left + 4,
            });
          }
        }
      });

      setResolvedIndicators(newIndicators);
    };

    updateIndicatorPositions();

    // Update on scroll
    const scrollDisposable = modifiedEditor.onDidScrollChange(updateIndicatorPositions);

    return () => {
      scrollDisposable.dispose();
    };
  }, [monaco, discussionsByLine, expandedResolvedThreads, inlineCommentsEnabled, editorReady]);

  // Handle glyph margin click to expand resolved threads
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco || !inlineCommentsEnabled || !editorReady) return;

    const modifiedEditor = editor.getModifiedEditor();

    const disposable = modifiedEditor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        if (!lineNumber) return;

        const lineDiscussions = discussionsByLine.get(lineNumber) || [];
        const resolvedDiscussions = lineDiscussions.filter((d) => isDiscussionResolved(d));

        // If clicking on a resolved thread indicator, toggle its expansion
        if (resolvedDiscussions.length > 0) {
          const allExpanded = resolvedDiscussions.every((d) => expandedResolvedThreads.has(d.id));
          resolvedDiscussions.forEach((d) => {
            if (allExpanded) {
              // Collapse all
              if (expandedResolvedThreads.has(d.id)) {
                toggleResolvedThread(d.id);
              }
            } else {
              // Expand all
              if (!expandedResolvedThreads.has(d.id)) {
                toggleResolvedThread(d.id);
              }
            }
          });
        }
      }
    });

    return () => disposable.dispose();
  }, [monaco, discussionsByLine, expandedResolvedThreads, toggleResolvedThread, inlineCommentsEnabled, editorReady]);

  const handleEditorMount = (editor: Monaco.editor.IStandaloneDiffEditor) => {
    editorRef.current = editor;
    setEditorReady(true);

    // Set up GitLab-style comment trigger
    if (inlineCommentsEnabled && monaco) {
      const modifiedEditor = editor.getModifiedEditor();

      // Calculate position for the "+" button overlay
      const updateGlyphPosition = (lineNumber: number | null) => {
        if (lineNumber === null) {
          setHoveredLine(null);
          setGlyphPosition(null);
          return;
        }

        const editorDom = modifiedEditor.getDomNode();
        if (!editorDom) return;

        const lineTop = modifiedEditor.getTopForLineNumber(lineNumber);
        const scrollTop = modifiedEditor.getScrollTop();
        const lineHeight = modifiedEditor.getOption(monaco.editor.EditorOption.lineHeight) || 20;

        // Get the editor's bounding rect
        const rect = editorDom.getBoundingClientRect();

        // Position the glyph in the gutter area (left side)
        setHoveredLine(lineNumber);
        setGlyphPosition({
          top: rect.top + lineTop - scrollTop + (lineHeight / 2) - 9, // Center vertically (18px button / 2)
          left: rect.left + 4, // In the gutter
        });
      };

      // Track mouse movement to show/hide the "+" button
      modifiedEditor.onMouseMove((e) => {
        // Show "+" when hovering over gutter or line content
        const validTargets = [
          monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS,
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
          monaco.editor.MouseTargetType.CONTENT_TEXT,
          monaco.editor.MouseTargetType.CONTENT_EMPTY,
        ];

        if (validTargets.includes(e.target.type)) {
          const lineNumber = e.target.position?.lineNumber;
          if (lineNumber && lineNumber !== activeCommentLineRef.current) {
            updateGlyphPosition(lineNumber);
          }
        }
      });

      // Hide "+" when mouse leaves the editor (with delay to allow clicking the button)
      modifiedEditor.onMouseLeave(() => {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringButtonRef.current && !activeCommentLineRef.current) {
            updateGlyphPosition(null);
          }
        }, 150);
      });
    }
  };

  const editorOptions: Monaco.editor.IDiffEditorConstructionOptions = {
    readOnly: true,
    renderSideBySide: diffViewMode === 'split',
    renderWhitespace: showWhitespace ? 'all' : 'none',
    minimap: { enabled: false },
    lineNumbers: 'on',
    glyphMargin: inlineCommentsEnabled, // Enable glyph margin when comments are enabled
    scrollBeyondLastLine: false,
    folding: true,
    wordWrap: wordWrap ? 'on' : 'off',
    automaticLayout: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
    renderIndicators: true,
    originalEditable: false,
    ignoreTrimWhitespace: !showWhitespace,
    renderOverviewRuler: true,
    diffWordWrap: wordWrap ? 'on' : 'off',
    // When full files are loaded, collapse unchanged regions to show only diff hunks
    hideUnchangedRegions: { enabled: useFullFiles },
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
          {/* Comment count indicator */}
          {fileDiscussions.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">
              <CommentIcon />
              {fileDiscussions.length}
            </span>
          )}
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

          {/* Word wrap toggle */}
          <button
            onClick={toggleWordWrap}
            className={`px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded ${
              wordWrap
                ? 'bg-gray-200 dark:bg-gray-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2V3zm0 8h5v1.5H2V11zm10.5-4H2v1.5h10.5a1.75 1.75 0 110 3.5H11v-1.25L8.5 12l2.5 2.25V13h1.5a3.25 3.25 0 000-6.5z" />
            </svg>
          </button>

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
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {isLoadingOriginal || isLoadingModified ? (
          <DiffLoading />
        ) : (
          <DiffEditor
            original={original}
            modified={modified}
            language={language}
            theme={theme === 'vs-dark' ? 'gitlab-dark' : 'gitlab-light'}
            options={editorOptions}
            onMount={handleEditorMount}
            loading={<DiffLoading />}
          />
        )}

        {/* Inline thread portals - render into view zone DOM nodes */}
        {inlineCommentsEnabled && projectId && mrIid && viewZoneContainers.map((container) => createPortal(
          <div key={`thread-${container.lineNumber}`} className="space-y-2 py-2">
            {container.discussions.map((discussion) => {
              const isResolved = isDiscussionResolved(discussion);
              return (
                <InlineCommentThread
                  key={discussion.id}
                  discussion={discussion}
                  projectId={projectId}
                  mrIid={mrIid}
                  mrAuthor={mrAuthor}
                  position={buildCommentPosition(container.lineNumber) || undefined}
                  onSuccess={handleCommentSuccess}
                  onHeightChange={(_height) => {
                    // Update view zone height when thread content changes
                    const editor = editorRef.current;
                    if (editor) {
                      editor.getModifiedEditor().changeViewZones((accessor) => {
                        accessor.layoutZone(container.zoneId);
                      });
                    }
                  }}
                  compact
                  onCollapse={isResolved ? () => toggleResolvedThread(discussion.id) : undefined}
                />
              );
            })}
          </div>,
          container.domNode
        ))}

        {/* Resolved thread avatar indicators in gutter - rendered via portal */}
        {inlineCommentsEnabled && resolvedIndicators.map((indicator) => createPortal(
          <button
            key={indicator.discussionId}
            type="button"
            onClick={() => toggleResolvedThread(indicator.discussionId)}
            className="fixed z-[999] w-[20px] h-[20px] rounded-full cursor-pointer shadow-md ring-2 ring-green-500 hover:ring-green-400 hover:scale-110 transition-all overflow-hidden bg-gray-800"
            style={{
              top: indicator.top,
              left: indicator.left,
            }}
            title={`Resolved thread by ${indicator.authorName} - click to expand`}
          >
            <Avatar
              src={indicator.avatarUrl}
              name={indicator.authorName}
              size="xs"
              className="w-full h-full"
            />
          </button>,
          document.body
        ))}

        {/* GitLab-style "+" button in gutter - rendered via portal */}
        {inlineCommentsEnabled && hoveredLine && glyphPosition && !activeCommentLine && baseSha && headSha && createPortal(
          <button
            type="button"
            onClick={() => handleOpenComment(hoveredLine)}
            onMouseEnter={() => {
              isHoveringButtonRef.current = true;
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
              }
            }}
            onMouseLeave={() => {
              isHoveringButtonRef.current = false;
            }}
            className="fixed z-[1000] w-[18px] h-[18px] rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center cursor-pointer shadow-sm transition-colors"
            style={{
              top: glyphPosition.top,
              left: glyphPosition.left,
            }}
            title={`Add comment on line ${hoveredLine}`}
          >
            +
          </button>,
          document.body
        )}

        {/* Inline comment form - rendered in view zone (scrolls with code) */}
        {inlineCommentsEnabled && activeCommentLine && commentViewZoneContainer && projectId && mrIid && baseSha && headSha && createPortal(
          <div className="py-2">
            <InlineCommentOverlay
              projectId={projectId}
              mrIid={mrIid}
              filePath={file.new_path}
              lineNumber={activeCommentLine}
              position={buildCommentPosition(activeCommentLine)!}
              originalCode={getLineContent(activeCommentLine)}
              discussions={getDiscussionsForLine(activeCommentLine)}
              isNew={true}
              onClose={handleCloseComment}
              onSuccess={handleCommentSuccess}
              disableClickOutside
            />
          </div>,
          commentViewZoneContainer.domNode
        )}

        {/* Suggestion editor - rendered in view zone */}
        {inlineCommentsEnabled && activeSuggestionLine && suggestionViewZoneContainer && projectId && mrIid && baseSha && headSha && createPortal(
          <div className="py-2">
            <SuggestionEditor
              originalCode={getLineContent(activeSuggestionLine)}
              lineNumber={activeSuggestionLine}
              language={language}
              projectId={projectId}
              mrIid={mrIid}
              position={buildCommentPosition(activeSuggestionLine)!}
              onSubmit={handleSuggestionSuccess}
              onCancel={handleCloseSuggestion}
              onDiscussionsChange={onDiscussionsChange}
            />
          </div>,
          suggestionViewZoneContainer.domNode
        )}

        {/* Mode indicator */}
        {diffMode === 'line-nav' && currentZone === 'diff' && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-1.5 bg-gray-900/90 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-400 backdrop-blur-sm">
            <span><kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">j/k</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">n/p</kbd> scroll</span>
            <span><kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">c</kbd> comment</span>
            <span><kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">s</kbd> suggest</span>
            <span><kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> back to files</span>
          </div>
        )}
      </div>
    </div>
  );
});

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

function CommentIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
