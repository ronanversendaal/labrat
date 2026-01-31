/**
 * DiffView - Display syntax-highlighted diff with line numbers
 * Supports unified and split view modes
 */

import { useMemo, useState, useCallback } from 'react';
import type { DiffFile, LineType } from '../../types';
import { useUIStore } from '../../stores';

interface DiffViewProps {
  file: DiffFile;
  onNextFile?: () => void;
  onPrevFile?: () => void;
}

export function DiffView({ file, onNextFile, onPrevFile }: DiffViewProps) {
  const { diffViewMode, setDiffViewMode, showWhitespace, toggleWhitespace } = useUIStore();
  const [collapsedHunks, setCollapsedHunks] = useState<Set<number>>(new Set());

  // Parse diff lines
  const lines = useMemo(() => parseDiffLines(file.diff), [file.diff]);

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
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <FileStatusBadge file={file} />
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate">
            {file.renamed_file ? `${file.old_path} → ${file.new_path}` : file.new_path}
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
              Unified
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              className={`px-2 py-1 text-xs ${
                diffViewMode === 'split'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Split
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

      {/* Diff content */}
      <div className="flex-1 overflow-auto font-mono text-sm">
        {diffViewMode === 'unified' ? (
          <UnifiedDiff
            lines={lines}
            showWhitespace={showWhitespace}
            collapsedHunks={collapsedHunks}
            onToggleHunk={toggleHunk}
          />
        ) : (
          <SplitDiff
            lines={lines}
            showWhitespace={showWhitespace}
            collapsedHunks={collapsedHunks}
            onToggleHunk={toggleHunk}
          />
        )}
      </div>
    </div>
  );
}

interface ParsedLine {
  type: LineType;
  oldLine: number | null;
  newLine: number | null;
  content: string;
  isHunkHeader: boolean;
  hunkIndex: number;
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
}: {
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line, i) => {
          if (line.isHunkHeader) {
            return (
              <tr key={i} className="bg-blue-50 dark:bg-blue-900/20">
                <td
                  colSpan={3}
                  className="px-2 py-1 text-blue-700 dark:text-blue-300 cursor-pointer select-none"
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

          const bgClass = getLineBgClass(line.type);
          const content = showWhitespace ? renderWhitespace(line.content) : line.content;

          return (
            <tr key={i} className={bgClass}>
              <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200 dark:border-gray-700">
                {line.oldLine ?? ''}
              </td>
              <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200 dark:border-gray-700">
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
}: {
  lines: ParsedLine[];
  showWhitespace: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
}) {
  // Build paired lines for split view
  const pairs = useMemo(() => buildSplitPairs(lines), [lines]);

  return (
    <table className="w-full border-collapse">
      <tbody>
        {pairs.map((pair, i) => {
          if (pair.isHunkHeader) {
            return (
              <tr key={i} className="bg-blue-50 dark:bg-blue-900/20">
                <td
                  colSpan={4}
                  className="px-2 py-1 text-blue-700 dark:text-blue-300 cursor-pointer select-none"
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

          return (
            <tr key={i}>
              {/* Old side */}
              <td className={`w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200 dark:border-gray-700 ${pair.left?.type === 'deletion' ? 'bg-red-100 dark:bg-red-900/30' : ''}`}>
                {pair.left?.oldLine ?? ''}
              </td>
              <td className={`w-1/2 px-2 py-0 whitespace-pre border-r border-gray-200 dark:border-gray-700 ${pair.left?.type === 'deletion' ? 'bg-red-100 dark:bg-red-900/30' : ''}`}>
                {pair.left ? (showWhitespace ? renderWhitespace(pair.left.content) : pair.left.content) : '\u00A0'}
              </td>
              {/* New side */}
              <td className={`w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200 dark:border-gray-700 ${pair.right?.type === 'addition' ? 'bg-green-100 dark:bg-green-900/30' : ''}`}>
                {pair.right?.newLine ?? ''}
              </td>
              <td className={`w-1/2 px-2 py-0 whitespace-pre ${pair.right?.type === 'addition' ? 'bg-green-100 dark:bg-green-900/30' : ''}`}>
                {pair.right ? (showWhitespace ? renderWhitespace(pair.right.content) : pair.right.content) : '\u00A0'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface SplitPair {
  left: ParsedLine | null;
  right: ParsedLine | null;
  isHunkHeader: boolean;
  hunkIndex: number;
  content?: string;
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
      return 'bg-green-50 dark:bg-green-900/20';
    case 'deletion':
      return 'bg-red-50 dark:bg-red-900/20';
    default:
      return '';
  }
}

function renderWhitespace(content: string): string {
  return content.replace(/ /g, '·').replace(/\t/g, '→   ');
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
