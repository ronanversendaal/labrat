/**
 * FileTree - Display list of changed files with expand/collapse
 * Supports both tree view (folder hierarchy) and flat list view
 */

import { useState, useMemo } from 'react';
import type { DiffFile } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';

interface FileTreeProps {
  files: DiffFile[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  expandedFolders?: Set<string>;
  onToggleFolder?: (folder: string) => void;
}

export function FileTree({
  files,
  selectedFile,
  onSelectFile,
  expandedFolders = new Set(),
  onToggleFolder,
}: FileTreeProps) {
  const [localExpanded, setLocalExpanded] = useState<Set<string>>(new Set());
  const fileViewMode = useSettingsStore((state) => state.fileViewMode);
  const setFileViewMode = useSettingsStore((state) => state.setFileViewMode);

  const expanded = onToggleFolder ? expandedFolders : localExpanded;
  const toggleFolder = onToggleFolder || ((folder: string) => {
    setLocalExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  });

  // Build file tree structure
  const tree = useMemo(() => buildFileTree(files), [files]);

  // Sort files alphabetically for flat view
  const sortedFiles = useMemo(() =>
    [...files].sort((a, b) => a.new_path.localeCompare(b.new_path)),
    [files]
  );

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          Files Changed
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {files.length}
          </span>
          {/* View mode toggle button */}
          <button
            onClick={() => setFileViewMode(fileViewMode === 'tree' ? 'flat' : 'tree')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            title={fileViewMode === 'tree' ? 'Switch to flat list' : 'Switch to tree view'}
          >
            {fileViewMode === 'tree' ? <ListIcon /> : <TreeIcon />}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {fileViewMode === 'tree' ? (
          // Tree view - folder hierarchy
          tree.children.map((node) => (
            <FileTreeNode
              key={node.name}
              node={node}
              path=""
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              expanded={expanded}
              onToggleFolder={toggleFolder}
            />
          ))
        ) : (
          // Flat view - simple list
          sortedFiles.map((file) => (
            <FlatFileItem
              key={file.new_path}
              file={file}
              isSelected={selectedFile === file.new_path}
              onSelect={() => onSelectFile(file.new_path)}
            />
          ))
        )}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <FileStats files={files} />
      </div>
    </div>
  );
}

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  file?: DiffFile;
  children: TreeNode[];
}

function FileTreeNode({
  node,
  path,
  selectedFile,
  onSelectFile,
  expanded,
  onToggleFolder,
}: {
  node: TreeNode;
  path: string;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  expanded: Set<string>;
  onToggleFolder: (folder: string) => void;
}) {
  const fullPath = path ? `${path}/${node.name}` : node.name;
  const isExpanded = expanded.has(fullPath);

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(fullPath)}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
        >
          <ChevronIcon expanded={isExpanded} />
          <FolderIcon />
          <span className="text-gray-700 dark:text-gray-300 truncate">{node.name}</span>
          <span className="ml-auto text-xs text-gray-400">
            {countFiles(node)} files
          </span>
        </button>
        {isExpanded && (
          <div className="pl-4">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.name}
                node={child}
                path={fullPath}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                expanded={expanded}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const file = node.file!;
  const isSelected = selectedFile === file.new_path;

  return (
    <button
      onClick={() => onSelectFile(file.new_path)}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-left
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        }
      `}
    >
      <FileIcon file={file} />
      <span className="truncate flex-1">{node.name}</span>
      <FileChangeBadge file={file} />
    </button>
  );
}

function FileIcon({ file }: { file: DiffFile }) {
  if (file.new_file) {
    return <span className="text-green-500 text-xs font-medium">A</span>;
  }
  if (file.deleted_file) {
    return <span className="text-red-500 text-xs font-medium">D</span>;
  }
  if (file.renamed_file) {
    return <span className="text-purple-500 text-xs font-medium">R</span>;
  }
  return <span className="text-yellow-500 text-xs font-medium">M</span>;
}

function FileChangeBadge({ file }: { file: DiffFile }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      {file.additions > 0 && (
        <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
      )}
      {file.deletions > 0 && (
        <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
      )}
    </span>
  );
}

function FileStats({ files }: { files: DiffFile[] }) {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-green-600 dark:text-green-400">
        +{totalAdditions} additions
      </span>
      <span className="text-red-600 dark:text-red-400">
        -{totalDeletions} deletions
      </span>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function buildFileTree(files: DiffFile[]): TreeNode {
  const root: TreeNode = { name: '', type: 'folder', children: [] };

  for (const file of files) {
    const parts = file.new_path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          type: isLast ? 'file' : 'folder',
          file: isLast ? file : undefined,
          children: [],
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root.children);

  return root;
}

function countFiles(node: TreeNode): number {
  if (node.type === 'file') return 1;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function FlatFileItem({
  file,
  isSelected,
  onSelect,
}: {
  file: DiffFile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-left
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        }
      `}
    >
      <FileIcon file={file} />
      <span className="truncate flex-1" title={file.new_path}>
        {file.new_path}
      </span>
      <FileChangeBadge file={file} />
    </button>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
