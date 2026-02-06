/**
 * VirtualizedDiff - Virtualized diff rendering for large files
 * Uses react-window v2 for efficient rendering of 10,000+ line diffs
 */

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import { List, useListRef } from 'react-window';
import type { LineType } from '../../types';

export interface ParsedLine {
  type: LineType;
  oldLine: number | null;
  newLine: number | null;
  content: string;
  isHunkHeader: boolean;
  hunkIndex: number;
}

export interface SplitPair {
  left: ParsedLine | null;
  right: ParsedLine | null;
  isHunkHeader: boolean;
  hunkIndex: number;
  content?: string;
}

interface VirtualizedUnifiedDiffProps {
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
  height: number;
}

interface VirtualizedSplitDiffProps {
  pairs: SplitPair[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
  height: number;
}

const ROW_HEIGHT = 22; // Height of each row in pixels

// Props passed via rowProps to UnifiedRow
interface UnifiedRowProps {
  visibleLines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
}

// Props passed via rowProps to SplitRow
interface SplitRowProps {
  visiblePairs: SplitPair[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  highlightedLine: number | null;
}

// Row component for unified diff view
function UnifiedRow({
  index,
  style,
  visibleLines,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
}: {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & UnifiedRowProps): ReactElement | null {
  const line = visibleLines[index];

  if (!line) return null;

  if (line.isHunkHeader) {
    return (
      <div
        style={style}
        className="flex bg-primary-muted cursor-pointer select-none"
        onClick={() => onToggleHunk(line.hunkIndex)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onToggleHunk(line.hunkIndex);
          }
        }}
      >
        <span className="w-24 px-2 text-center text-primary-text flex-shrink-0">
          {collapsedHunks.has(line.hunkIndex) ? '▶' : '▼'}
        </span>
        <span className="flex-1 px-2 text-primary-text truncate">
          {line.content}
        </span>
      </div>
    );
  }

  const isHighlighted =
    highlightedLine !== null &&
    (line.newLine === highlightedLine || line.oldLine === highlightedLine);
  const bgClass = isHighlighted
    ? 'bg-caution-muted'
    : getLineBgClass(line.type);
  const content = showWhitespace ? renderWhitespace(line.content) : line.content;

  return (
    <div
      style={style}
      className={`flex ${bgClass}`}
      data-line={line.newLine ?? line.oldLine}
    >
      <span className="w-12 px-2 text-right text-gray-400 select-none border-r border-edge flex-shrink-0">
        {line.oldLine ?? ''}
      </span>
      <span className="w-12 px-2 text-right text-gray-400 select-none border-r border-edge flex-shrink-0">
        {line.newLine ?? ''}
      </span>
      <span className="flex-1 px-2 whitespace-pre truncate font-mono text-sm">
        {content || '\u00A0'}
      </span>
    </div>
  );
}

export function VirtualizedUnifiedDiff({
  lines,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
  height,
}: VirtualizedUnifiedDiffProps) {
  const listRef = useListRef(null);

  // Filter out collapsed hunk lines
  const visibleLines = lines.filter((line) => {
    if (line.isHunkHeader) return true;
    return !collapsedHunks.has(line.hunkIndex);
  });

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightedLine !== null && listRef.current) {
      const index = visibleLines.findIndex(
        (line) => line.newLine === highlightedLine || line.oldLine === highlightedLine
      );
      if (index !== -1) {
        listRef.current.scrollToRow({ index, align: 'center' });
      }
    }
  }, [highlightedLine, visibleLines, listRef]);

  const rowProps: UnifiedRowProps = {
    visibleLines,
    showWhitespace,
    collapsedHunks,
    onToggleHunk,
    highlightedLine,
  };

  return (
    <List
      listRef={listRef}
      defaultHeight={height}
      rowCount={visibleLines.length}
      rowHeight={ROW_HEIGHT}
      rowProps={rowProps}
      rowComponent={UnifiedRow}
      className="font-mono text-sm"
      overscanCount={20}
      style={{ height, width: '100%' }}
    />
  );
}

// Row component for split diff view
function SplitRow({
  index,
  style,
  visiblePairs,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
}: {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & SplitRowProps): ReactElement | null {
  const pair = visiblePairs[index];

  if (!pair) return null;

  if (pair.isHunkHeader) {
    return (
      <div
        style={style}
        className="flex bg-primary-muted cursor-pointer select-none"
        onClick={() => onToggleHunk(pair.hunkIndex)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onToggleHunk(pair.hunkIndex);
          }
        }}
      >
        <span className="w-24 px-2 text-center text-primary-text">
          {collapsedHunks.has(pair.hunkIndex) ? '▶' : '▼'}
        </span>
        <span className="flex-1 px-2 text-primary-text truncate">
          {pair.content}
        </span>
      </div>
    );
  }

  const isLeftHighlighted =
    highlightedLine !== null && pair.left?.oldLine === highlightedLine;
  const isRightHighlighted =
    highlightedLine !== null && pair.right?.newLine === highlightedLine;
  const dataLine = pair.right?.newLine ?? pair.left?.oldLine;

  return (
    <div style={style} className="flex" data-line={dataLine}>
      {/* Old side */}
      <span
        className={`w-12 px-2 text-right text-gray-400 select-none border-r border-edge flex-shrink-0 ${
          isLeftHighlighted
            ? 'bg-caution-muted'
            : pair.left?.type === 'deletion'
              ? 'bg-diff-del-bg'
              : ''
        }`}
      >
        {pair.left?.oldLine ?? ''}
      </span>
      <span
        className={`w-1/2 px-2 whitespace-pre truncate font-mono text-sm border-r border-edge ${
          isLeftHighlighted
            ? 'bg-caution-muted'
            : pair.left?.type === 'deletion'
              ? 'bg-diff-del-bg'
              : ''
        }`}
      >
        {pair.left
          ? showWhitespace
            ? renderWhitespace(pair.left.content)
            : pair.left.content
          : '\u00A0'}
      </span>
      {/* New side */}
      <span
        className={`w-12 px-2 text-right text-gray-400 select-none border-r border-edge flex-shrink-0 ${
          isRightHighlighted
            ? 'bg-caution-muted'
            : pair.right?.type === 'addition'
              ? 'bg-diff-add-bg'
              : ''
        }`}
      >
        {pair.right?.newLine ?? ''}
      </span>
      <span
        className={`w-1/2 px-2 whitespace-pre truncate font-mono text-sm ${
          isRightHighlighted
            ? 'bg-caution-muted'
            : pair.right?.type === 'addition'
              ? 'bg-diff-add-bg'
              : ''
        }`}
      >
        {pair.right
          ? showWhitespace
            ? renderWhitespace(pair.right.content)
            : pair.right.content
          : '\u00A0'}
      </span>
    </div>
  );
}

export function VirtualizedSplitDiff({
  pairs,
  showWhitespace,
  collapsedHunks,
  onToggleHunk,
  highlightedLine,
  height,
}: VirtualizedSplitDiffProps) {
  const listRef = useListRef(null);

  // Filter out collapsed hunk pairs
  const visiblePairs = pairs.filter((pair) => {
    if (pair.isHunkHeader) return true;
    return !collapsedHunks.has(pair.hunkIndex);
  });

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightedLine !== null && listRef.current) {
      const index = visiblePairs.findIndex(
        (pair) =>
          pair.left?.oldLine === highlightedLine ||
          pair.right?.newLine === highlightedLine
      );
      if (index !== -1) {
        listRef.current.scrollToRow({ index, align: 'center' });
      }
    }
  }, [highlightedLine, visiblePairs, listRef]);

  const rowProps: SplitRowProps = {
    visiblePairs,
    showWhitespace,
    collapsedHunks,
    onToggleHunk,
    highlightedLine,
  };

  return (
    <List
      listRef={listRef}
      defaultHeight={height}
      rowCount={visiblePairs.length}
      rowHeight={ROW_HEIGHT}
      rowProps={rowProps}
      rowComponent={SplitRow}
      className="font-mono text-sm"
      overscanCount={20}
      style={{ height, width: '100%' }}
    />
  );
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

// Threshold for switching to virtualized rendering
export const VIRTUALIZATION_THRESHOLD = 1000;

// Helper to check if virtualization should be used
export function shouldVirtualize(lineCount: number): boolean {
  return lineCount > VIRTUALIZATION_THRESHOLD;
}
