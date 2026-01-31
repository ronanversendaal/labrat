/**
 * QuickFilePicker - Fuzzy search modal for quickly selecting files in the diff
 * Triggered by ⌘+P or T keyboard shortcut
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { DiffFile } from '../../types';
import { Modal } from '../common';

interface QuickFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  files: DiffFile[];
  onSelectFile: (filePath: string) => void;
  currentFile?: string | null;
}

export function QuickFilePicker({
  isOpen,
  onClose,
  files,
  onSelectFile,
  currentFile,
}: QuickFilePickerProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a brief delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fuzzy match files
  const filteredFiles = useMemo(() => {
    if (!query.trim()) {
      return files;
    }

    const lowerQuery = query.toLowerCase();
    const queryParts = lowerQuery.split(/[\s/\\]+/).filter(Boolean);

    return files
      .map((file) => {
        const path = file.new_path.toLowerCase();
        const fileName = path.split('/').pop() || '';

        // Calculate match score
        let score = 0;

        // Exact filename match
        if (fileName === lowerQuery) {
          score += 100;
        }

        // Filename starts with query
        if (fileName.startsWith(lowerQuery)) {
          score += 50;
        }

        // Filename contains query
        if (fileName.includes(lowerQuery)) {
          score += 30;
        }

        // Path contains query
        if (path.includes(lowerQuery)) {
          score += 20;
        }

        // All query parts found in path
        const allPartsFound = queryParts.every((part) => path.includes(part));
        if (allPartsFound) {
          score += 10 * queryParts.length;
        }

        // Fuzzy character matching
        let queryIndex = 0;
        for (let i = 0; i < path.length && queryIndex < lowerQuery.length; i++) {
          if (path[i] === lowerQuery[queryIndex]) {
            queryIndex++;
            score += 1;
          }
        }

        // All characters matched in order
        if (queryIndex === lowerQuery.length) {
          score += 15;
        }

        return { file, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.file);
  }, [files, query]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredFiles.length) {
      setSelectedIndex(Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onSelectFile(filteredFiles[selectedIndex].new_path);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleSelectFile = (filePath: string) => {
    onSelectFile(filePath);
    onClose();
  };

  const getFileIcon = (file: DiffFile) => {
    if (file.new_file) {
      return (
        <span className="text-green-500 text-xs font-medium" title="New file">
          A
        </span>
      );
    }
    if (file.deleted_file) {
      return (
        <span className="text-red-500 text-xs font-medium" title="Deleted file">
          D
        </span>
      );
    }
    if (file.renamed_file) {
      return (
        <span className="text-blue-500 text-xs font-medium" title="Renamed file">
          R
        </span>
      );
    }
    return (
      <span className="text-yellow-500 text-xs font-medium" title="Modified file">
        M
      </span>
    );
  };

  const highlightMatch = (path: string) => {
    if (!query.trim()) {
      return path;
    }

    const lowerPath = path.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find and highlight matching characters
    let queryIndex = 0;
    for (let i = 0; i < path.length && queryIndex < lowerQuery.length; i++) {
      if (lowerPath[i] === lowerQuery[queryIndex]) {
        // Add non-matching part before this character
        if (i > lastIndex) {
          parts.push(path.substring(lastIndex, i));
        }
        // Add highlighted character
        parts.push(
          <span key={i} className="text-blue-500 font-medium">
            {path[i]}
          </span>
        );
        lastIndex = i + 1;
        queryIndex++;
      }
    }

    // Add remaining non-matching part
    if (lastIndex < path.length) {
      parts.push(path.substring(lastIndex));
    }

    return parts.length > 0 ? parts : path;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="md">
      <div className="flex flex-col" onKeyDown={handleKeyDown}>
        {/* Search input */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* File list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-auto"
        >
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No files match your search
            </div>
          ) : (
            <ul className="py-1">
              {filteredFiles.map((file, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = file.new_path === currentFile;
                const pathParts = file.new_path.split('/');
                const fileName = pathParts.pop() || '';
                const directory = pathParts.join('/');

                return (
                  <li
                    key={file.new_path}
                    data-index={index}
                    onClick={() => handleSelectFile(file.new_path)}
                    className={`
                      flex items-center gap-2 px-3 py-2 cursor-pointer text-sm
                      ${isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                      ${isCurrent ? 'font-medium' : ''}
                    `}
                  >
                    {/* File status icon */}
                    <span className="w-4 flex-shrink-0 text-center">
                      {getFileIcon(file)}
                    </span>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-gray-100 truncate">
                          {highlightMatch(fileName)}
                        </span>
                        {isCurrent && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            (current)
                          </span>
                        )}
                      </div>
                      {directory && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {highlightMatch(directory)}
                        </div>
                      )}
                    </div>

                    {/* Changes count */}
                    <div className="flex-shrink-0 flex items-center gap-1 text-xs">
                      {file.diff && (
                        <>
                          <span className="text-green-600 dark:text-green-400">
                            +{countAdditions(file.diff)}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            -{countDeletions(file.diff)}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer with hints */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">↑↓</kbd>
            {' '}to navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">↵</kbd>
            {' '}to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">esc</kbd>
            {' '}to close
          </span>
        </div>
      </div>
    </Modal>
  );
}

function countAdditions(diff: string): number {
  return (diff.match(/^\+(?!\+\+)/gm) || []).length;
}

function countDeletions(diff: string): number {
  return (diff.match(/^-(?!--)/gm) || []).length;
}
