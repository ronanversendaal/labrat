/**
 * DiffView - Display syntax-highlighted diff with line numbers
 * Supports unified and split view modes with virtualization for large diffs
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { DiffFile, LineType } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  VirtualizedUnifiedDiff,
  VirtualizedSplitDiff,
  shouldVirtualize,
  type ParsedLine,
  type SplitPair,
} from './VirtualizedDiff';

interface DiffViewProps {
  file: DiffFile;
  onNextFile?: () => void;
  onPrevFile?: () => void;
  targetLine?: number;
}

export function DiffView({ file, onNextFile, onPrevFile, targetLine }: DiffViewProps) {
  const diffViewMode = useSettingsStore((s) => s.diffViewMode);
  const setDiffViewMode = useSettingsStore((s) => s.setDiffViewMode);
  const showWhitespace = useSettingsStore((s) => s.showWhitespace);
  const toggleWhitespace = useSettingsStore((s) => s.toggleShowWhitespace);
  const [collapsedHunks, setCollapsedHunks] = useState<Set<number>>(new Set());
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse diff lines
  const lines = useMemo(() => parseDiffLines(file.diff), [file.diff]);

  // Scroll to target line when it changes
  useEffect(() => {
    if (targetLine && containerRef.current) {
      // Find the hunk containing this line and expand it
      const targetHunk = lines.find(
        (line) => line.newLine === targetLine || line.oldLine === targetLine
      );
      if (targetHunk && collapsedHunks.has(targetHunk.hunkIndex)) {
        setCollapsedHunks((prev) => {
          const next = new Set(prev);
          next.delete(targetHunk.hunkIndex);
          return next;
        });
      }

      // Set highlighted line and scroll to it after a short delay
      setHighlightedLine(targetLine);
      setTimeout(() => {
        const lineElement = containerRef.current?.querySelector(`[data-line="${targetLine}"]`);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Clear highlight after a few seconds
      setTimeout(() => setHighlightedLine(null), 3000);
    }
  }, [targetLine, lines, collapsedHunks]);

  const toggleHunk = useCallback((index: number) => {
    setCollapsedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge bg-surface">
        <div className="flex items-center gap-3">
          <FileStatusBadge file={file} />
          <span className="font-mono text-sm text-content-muted truncate">
            {file.renamed_file ? `${file.old_path} → ${file.new_path}` : file.new_path}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <span className="text-xs text-diff-add-text">+{file.additions}</span>
          <span className="text-xs text-diff-del-text">-{file.deletions}</span>

          {/* View mode toggle */}
          <div className="flex items-center ml-4 border border-edge-strong rounded overflow-hidden">
            <button
              onClick={() => setDiffViewMode('unified')}
              className={`px-2 py-1 text-xs ${
                diffViewMode === 'unified'
                  ? 'bg-surface-alt text-content'
                  : 'text-content-secondary hover:bg-surface-hover'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-1 text-xs ${
                diffViewMode === 'split'
                  ? 'bg-surface-alt text-content'
                  : 'text-content-secondary hover:bg-surface-hover'
              }`}
            >
              Split
            </button>
          </div>

          {/* Whitespace toggle */}
          <button
            onClick={toggleWhitespace}
            className={`px-2 py-1 text-xs border border-edge-strong rounded ${
              showWhitespace
                ? 'bg-surface-alt'
                : 'hover:bg-surface-hover'
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
                className="p-1 text-content-secondary hover:text-content-muted disabled:opacity-30"
                title="Previous file (k)"
              >
                <ChevronUpIcon />
              </button>
              <button
                onClick={onNextFile}
                disabled={!onNextFile}
                className="p-1 text-content-secondary hover:text-content-muted disabled:opacity-30"
                title="Next file (j)"
              >
                <ChevronDownIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Diff content */}
      <DiffContent
        containerRef={containerRef}
        diffViewMode={diffViewMode}
        lines={lines}
        showWhitespace={showWhitespace}
        collapsedHunks={collapsedHunks}
        onToggleHunk={toggleHunk}
        highlightedLine={highlightedLine}
      />
    </div>
  );
}

// Separate component for diff content to handle virtualization
function DiffContent({
  containerRef,
  diffViewMode,
  lines,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  diffViewMode: 'unified' | 'split';
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
}) {
  const [containerHeight, setContainerHeight] = useState(500);
  const useVirtualization = shouldVirtualize(lines.length);
  const splitPairs = useMemo(() => buildSplitPairs(lines), [lines]);

  // Track container size for virtualized rendering
  useEffect(() => {
    if (!useVirtualization || !containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [useVirtualization, containerRef]);

  if (useVirtualization) {
    return (
      <div ref={containerRef} className="flex-1 overflow-hidden font-mono text-sm">
        {diffViewMode === 'unified' ? (
          <VirtualizedUnifiedDiff
            lines={lines}
            showWhitespace={showWhitespace}
            collapsedHunks={collapsedHunks}
            onToggleHunk={onToggleHunk}
            highlightedLine={highlightedLine}
            height={containerHeight}
          />
        ) : (
          <VirtualizedSplitDiff
            pairs={splitPairs}
            showWhitespace={showWhitespace}
            collapsedHunks={collapsedHunks}
            onToggleHunk={onToggleHunk}
            highlightedLine={highlightedLine}
            height={containerHeight}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-auto font-mono text-sm">
      {diffViewMode === 'unified' ? (
        <UnifiedDiff
          lines={lines}
          showWhitespace={showWhitespace}
          collapsedHunks={collapsedHunks}
          onToggleHunk={onToggleHunk}
          highlightedLine={highlightedLine}
        />
      ) : (
        <SplitDiff
          lines={lines}
          showWhitespace={showWhitespace}
          collapsedHunks={collapsedHunks}
          onToggleHunk={onToggleHunk}
          highlightedLine={highlightedLine}
        />
      )}
    </div>
  );
}

function parseDiffLines(diff: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hunkIndex = -1;

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('@@')) {
      hunkIndex++;
      // Parse @@ -old,count +new,count @@
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({
        type: 'header',
        oldLine: null,
        newLine: null,
        content: rawLine,
        isHunkHeader: true,
        hunkIndex,
      });
    } else if (rawLine.startsWith('---') || rawLine.startsWith('+++')) {
      lines.push({
        type: 'header',
        oldLine: null,
        newLine: null,
        content: rawLine,
        isHunkHeader: false,
        hunkIndex,
      });
    } else if (rawLine.startsWith('+')) {
      lines.push({
        type: 'addition',
        oldLine: null,
        newLine: newLine++,
        content: rawLine.slice(1),
        isHunkHeader: false,
        hunkIndex,
      });
    } else if (rawLine.startsWith('-')) {
      lines.push({
        type: 'deletion',
        oldLine: oldLine++,
        newLine: null,
        content: rawLine.slice(1),
        isHunkHeader: false,
        hunkIndex,
      });
    } else {
      // Context line
      const content = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
      lines.push({
        type: 'context',
        oldLine: oldLine++,
        newLine: newLine++,
        content,
        isHunkHeader: false,
        hunkIndex,
      });
    }
  }

  return lines;
}

function UnifiedDiff({
  lines,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
}: {
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line, i) => {
          if (line.isHunkHeader) {
            return (
              <tr key={i} className="bg-primary-muted">
                <td
                  colSpan={3}
                  className="px-2 py-1 text-primary-text cursor-pointer select-none"
                  onClick={() => onToggleHunk(line.hunkIndex)}
                >
                  {collapsedHunks.has(line.hunkIndex) ? '▶' : '▼'} {line.content}
                </td>
              </tr>
            );
          }

          if (collapsedHunks.has(line.hunkIndex)) {
            return null;
          }

          const isHighlighted = highlightedLine !== null && (line.newLine === highlightedLine || line.oldLine === highlightedLine);
          const bgClass = isHighlighted
            ? 'bg-caution-muted animate-pulse'
            : getLineBgClass(line.type);
          const content = showWhitespace ? renderWhitespace(line.content) : line.content;

          return (
            <tr
              key={i}
              className={bgClass}
              data-line={line.newLine ?? line.oldLine}
            >
              <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-edge">
                {line.oldLine ?? ''}
              </td>
              <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-edge">
                {line.newLine ?? ''}
              </td>
              <td className="px-2 py-0 whitespace-pre">{content || '\u00A0'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SplitDiff({
  lines,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
}: {
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
}) {
  // Build paired lines for split view
  const pairs = useMemo(() => buildSplitPairs(lines), [lines]);

  return (
    <table className="w-full border-collapse">
      <tbody>
        {pairs.map((pair, i) => {
          if (pair.isHunkHeader) {
            return (
              <tr key={i} className="bg-primary-muted">
                <td
                  colSpan={4}
                  className="px-2 py-1 text-primary-text cursor-pointer select-none"
                  onClick={() => onToggleHunk(pair.hunkIndex)}
                >
                  {collapsedHunks.has(pair.hunkIndex) ? '▶' : '▼'} {pair.content}
                </td>
              </tr>
            );
          }

          if (collapsedHunks.has(pair.hunkIndex)) {
            return null;
          }

          const isLeftHighlighted = highlightedLine !== null && pair.left?.oldLine === highlightedLine;
          const isRightHighlighted = highlightedLine !== null && pair.right?.newLine === highlightedLine;
          const dataLine = pair.right?.newLine ?? pair.left?.oldLine;

          return (
            <tr key={i} data-line={dataLine}>
              {/* Old side */}
              <td className={`w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-edge ${isLeftHighlighted ? 'bg-caution-muted animate-pulse' : pair.left?.type === 'deletion' ? 'bg-diff-del-bg' : ''}`}>
                {pair.left?.oldLine ?? ''}
              </td>
              <td className={`w-1/2 px-2 py-0 whitespace-pre border-r border-edge ${isLeftHighlighted ? 'bg-caution-muted animate-pulse' : pair.left?.type === 'deletion' ? 'bg-diff-del-bg' : ''}`}>
                {pair.left ? (showWhitespace ? renderWhitespace(pair.left.content) : pair.left.content) : '\u00A0'}
              </td>
              {/* New side */}
              <td className={`w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-edge ${isRightHighlighted ? 'bg-caution-muted animate-pulse' : pair.right?.type === 'addition' ? 'bg-diff-add-bg' : ''}`}>
                {pair.right?.newLine ?? ''}
              </td>
              <td className={`w-1/2 px-2 py-0 whitespace-pre ${isRightHighlighted ? 'bg-caution-muted animate-pulse' : pair.right?.type === 'addition' ? 'bg-diff-add-bg' : ''}`}>
                {pair.right ? (showWhitespace ? renderWhitespace(pair.right.content) : pair.right.content) : '\u00A0'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function buildSplitPairs(lines: ParsedLine[]): SplitPair[] {
  const pairs: SplitPair[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.isHunkHeader) {
      pairs.push({ left: null, right: null, isHunkHeader: true, hunkIndex: line.hunkIndex, content: line.content });
      i++;
      continue;
    }

    if (line.type === 'header') {
      i++;
      continue;
    }

    if (line.type === 'context') {
      pairs.push({ left: line, right: line, isHunkHeader: false, hunkIndex: line.hunkIndex });
      i++;
    } else if (line.type === 'deletion') {
      // Check if next line is addition (modification)
      const next = lines[i + 1];
      if (next && next.type === 'addition') {
        pairs.push({ left: line, right: next, isHunkHeader: false, hunkIndex: line.hunkIndex });
        i += 2;
      } else {
        pairs.push({ left: line, right: null, isHunkHeader: false, hunkIndex: line.hunkIndex });
        i++;
      }
    } else if (line.type === 'addition') {
      pairs.push({ left: null, right: line, isHunkHeader: false, hunkIndex: line.hunkIndex });
      i++;
    } else {
      i++;
    }
  }

  return pairs;
}

function getLineBgClass(type: LineType): string {
  switch (type) {
    case 'addition':
      return 'bg-diff-add-bg';
    case 'deletion':
      return 'bg-diff-del-bg';
    default:
      return '';
  }
}

function renderWhitespace(content: string): string {
  return content.replace(/ /g, '·').replace(/\t/g, '→   ');
}

function FileStatusBadge({ file }: { file: DiffFile }) {
  if (file.new_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-diff-add-bg text-diff-add-text rounded">Added</span>;
  }
  if (file.deleted_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-diff-del-bg text-diff-del-text rounded">Deleted</span>;
  }
  if (file.renamed_file) {
    return <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 bg-purple-900/30 text-purple-400 rounded">Renamed</span>;
  }
  return <span className="px-1.5 py-0.5 text-xs font-medium bg-caution-muted text-caution-text rounded">Modified</span>;
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
