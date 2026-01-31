/**
 * MRDetailView - Full merge request detail view with tabs for description, diff, discussions, AI
 */

import { useState, useMemo } from 'react';
import type { MergeRequest, Discussion } from '../../types';
import { useDiff, useDiscussions } from '../../hooks/useGitLab';
import { useAISuggestions } from '../../hooks/useAI';
import { MRDescription } from './MRDescription';
import { DiffView } from './DiffView';
import { FileTree } from './FileTree';
import { ImpedimentBadge } from '../mr-list/ImpedimentBadge';
import { Skeleton } from '../common';
import { AISuggestionsPanel } from '../ai';

interface MRDetailViewProps {
  mr: MergeRequest;
  onClose?: () => void;
}

type Tab = 'description' | 'changes' | 'discussions' | 'ai';

export function MRDetailView({ mr, onClose }: MRDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('changes');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const { data: diff, isLoading: isLoadingDiff } = useDiff(mr.project_id, mr.iid);
  const { data: discussions, isLoading: isLoadingDiscussions } = useDiscussions(mr.project_id, mr.iid);
  const { data: aiSuggestions } = useAISuggestions(mr.iid);
  const pendingAISuggestions = aiSuggestions?.filter((s) => s.status === 'pending').length || 0;

  // Auto-select first file when diff loads
  const selectedFile = useMemo(() => {
    if (!diff?.files.length) return null;
    const path = selectedFilePath || diff.files[0].new_path;
    return diff.files.find((f) => f.new_path === path) || null;
  }, [diff, selectedFilePath]);

  const handleToggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const handleNextFile = () => {
    if (!diff?.files.length || !selectedFile) return;
    const currentIndex = diff.files.findIndex((f) => f.new_path === selectedFile.new_path);
    if (currentIndex < diff.files.length - 1) {
      setSelectedFilePath(diff.files[currentIndex + 1].new_path);
    }
  };

  const handlePrevFile = () => {
    if (!diff?.files.length || !selectedFile) return;
    const currentIndex = diff.files.findIndex((f) => f.new_path === selectedFile.new_path);
    if (currentIndex > 0) {
      setSelectedFilePath(diff.files[currentIndex - 1].new_path);
    }
  };

  const unresolvedThreads = discussions?.filter(
    (d) => d.notes.some((n) => n.resolvable && !n.resolved)
  ).length || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Project path */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>{mr.project_path || `Project #${mr.project_id}`}</span>
              <span>•</span>
              <span>!{mr.iid}</span>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {mr.draft && <span className="text-gray-400 dark:text-gray-500">Draft: </span>}
              {mr.title}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <ImpedimentBadge mr={mr} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <a
              href={mr.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Open in GitLab
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 -mb-4">
          <TabButton
            active={activeTab === 'description'}
            onClick={() => setActiveTab('description')}
          >
            Description
          </TabButton>
          <TabButton
            active={activeTab === 'changes'}
            onClick={() => setActiveTab('changes')}
            badge={diff?.files.length}
          >
            Changes
          </TabButton>
          <TabButton
            active={activeTab === 'discussions'}
            onClick={() => setActiveTab('discussions')}
            badge={unresolvedThreads > 0 ? unresolvedThreads : undefined}
          >
            Discussions
          </TabButton>
          <TabButton
            active={activeTab === 'ai'}
            onClick={() => setActiveTab('ai')}
            badge={pendingAISuggestions > 0 ? pendingAISuggestions : undefined}
          >
            AI Review
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'description' && (
          <div className="p-6 overflow-auto h-full">
            <MRDescription mr={mr} />
          </div>
        )}

        {activeTab === 'changes' && (
          <div className="flex h-full">
            {/* File tree sidebar */}
            <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-auto">
              {isLoadingDiff ? (
                <div className="p-4 space-y-2">
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="70%" />
                </div>
              ) : diff?.files.length ? (
                <FileTree
                  files={diff.files}
                  selectedFile={selectedFile?.new_path || null}
                  onSelectFile={setSelectedFilePath}
                  expandedFolders={expandedFolders}
                  onToggleFolder={handleToggleFolder}
                />
              ) : (
                <div className="p-4 text-sm text-gray-500">No changes</div>
              )}
            </div>

            {/* Diff view */}
            <div className="flex-1 overflow-hidden">
              {isLoadingDiff ? (
                <div className="p-6 space-y-4">
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="rectangular" height={300} />
                </div>
              ) : selectedFile ? (
                <DiffView
                  file={selectedFile}
                  onNextFile={handleNextFile}
                  onPrevFile={handlePrevFile}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a file to view changes
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'discussions' && (
          <div className="p-6 overflow-auto h-full">
            {isLoadingDiscussions ? (
              <div className="space-y-4">
                <Skeleton variant="rectangular" height={100} />
                <Skeleton variant="rectangular" height={100} />
              </div>
            ) : discussions?.length ? (
              <DiscussionList discussions={discussions} />
            ) : (
              <div className="text-center text-gray-500 py-8">No discussions yet</div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <AISuggestionsPanel
            projectId={mr.project_id}
            mrIid={mr.iid}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
        ${active
          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-t border-x border-gray-200 dark:border-gray-700'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }
      `}
    >
      {children}
      {badge !== undefined && (
        <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

function DiscussionList({ discussions }: { discussions: Discussion[] }) {
  return (
    <div className="space-y-6">
      {discussions.map((discussion) => (
        <div
          key={discussion.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          {discussion.notes.map((note, i) => (
            <div
              key={note.id}
              className={`p-4 ${i > 0 ? 'border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {note.author.avatar_url ? (
                  <img
                    src={note.author.avatar_url}
                    alt={note.author.name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                    {note.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {note.author.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(note.created_at).toLocaleString()}
                </span>
                {note.resolvable && (
                  <span className={`ml-auto text-xs ${note.resolved ? 'text-green-600' : 'text-yellow-600'}`}>
                    {note.resolved ? 'Resolved' : 'Unresolved'}
                  </span>
                )}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {note.body_html ? (
                  <div dangerouslySetInnerHTML={{ __html: note.body_html }} />
                ) : (
                  <p className="whitespace-pre-wrap">{note.body}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
