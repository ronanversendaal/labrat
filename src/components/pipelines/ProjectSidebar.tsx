/**
 * ProjectSidebar - Left panel with pinned projects and search
 */

import { useState, useEffect, useRef } from 'react';
import { useProjectSearch, usePinnedProjects, usePinProject, useUnpinProject } from '../../hooks/usePipeline';
import { usePipelineStore } from '../../stores/pipelineStore';
import type { ProjectSearchResult, PinnedProject } from '../../types/gitlab';

export function ProjectSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { selectedProjectId, setSelectedProjectId } = usePipelineStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: pinnedProjects, isLoading: loadingPinned } = usePinnedProjects();
  const { data: searchResults, isLoading: searching, isFetching } = useProjectSearch(debouncedQuery);
  const pinProject = usePinProject();
  const unpinProject = useUnpinProject();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Show dropdown when we have a query
  useEffect(() => {
    setShowDropdown(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pinnedIds = new Set(pinnedProjects?.map((p) => p.project_id) || []);

  const handleTogglePin = (project: ProjectSearchResult | PinnedProject) => {
    const id = 'project_id' in project ? project.project_id : project.id;
    if (pinnedIds.has(id)) {
      unpinProject.mutate(id);
    } else {
      pinProject.mutate({
        projectId: id,
        path: project.path_with_namespace,
        name: project.name,
        webUrl: project.web_url,
        avatarUrl: project.avatar_url || undefined,
      });
    }
  };

  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setSearchQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
  };

  // Split "group/subgroup/project" into namespace + project name
  const splitPath = (path: string) => {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return { namespace: '', project: path };
    return {
      namespace: path.slice(0, lastSlash + 1),
      project: path.slice(lastSlash + 1),
    };
  };

  return (
    <div className="w-60 flex-shrink-0 border-r border-edge flex flex-col h-full bg-surface">
      {/* Search */}
      <div ref={containerRef} className="p-3 border-b border-edge relative">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (debouncedQuery.length >= 2) setShowDropdown(true);
            }}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-canvas border border-edge rounded text-primary placeholder-tertiary focus:outline-none focus:border-accent"
          />
          {/* Loading spinner or clear button */}
          {searchQuery && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {(searching || isFetching) && debouncedQuery.length >= 2 ? (
                <svg className="w-3.5 h-3.5 text-tertiary animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedQuery('');
                    setShowDropdown(false);
                    inputRef.current?.focus();
                  }}
                  className="text-tertiary hover:text-secondary cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search results dropdown — anchored to the search container, overflows to the right */}
        {showDropdown && (
          <div
            className="absolute z-20 top-full left-0 mt-0 bg-surface border border-edge rounded-lg shadow-lg max-h-80 overflow-auto"
            style={{ width: '360px' }}
          >
            {(searching || isFetching) && !searchResults ? (
              <div className="flex items-center gap-2 px-3 py-4 justify-center">
                <svg className="w-4 h-4 text-tertiary animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-tertiary">Searching...</span>
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <svg className="w-8 h-8 mx-auto mb-1 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-xs text-tertiary">No projects found for &ldquo;{debouncedQuery}&rdquo;</p>
              </div>
            ) : (
              searchResults?.map((project) => {
                const { namespace, project: projectName } = splitPath(project.path_with_namespace);
                const isPinned = pinnedIds.has(project.id);
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover cursor-pointer border-b border-edge last:border-b-0"
                    onClick={() => handleSelectProject(project.id)}
                  >
                    {/* Project avatar */}
                    {project.avatar_url ? (
                      <img
                        src={project.avatar_url}
                        alt=""
                        className="w-7 h-7 rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-accent">
                          {projectName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Project name + description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        <span className="text-tertiary">{namespace}</span>
                        <span className="font-medium text-primary">{projectName}</span>
                      </div>
                      {project.description && (
                        <div className="text-xs text-tertiary truncate mt-0.5">
                          {project.description}
                        </div>
                      )}
                    </div>
                    {/* Pin toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(project);
                      }}
                      className={`flex-shrink-0 cursor-pointer transition-colors ${
                        isPinned ? 'text-caution' : 'text-tertiary hover:text-caution'
                      }`}
                      title={isPinned ? 'Unpin project' : 'Pin project'}
                    >
                      <svg className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Pinned projects */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-tertiary uppercase tracking-wider">
            Pinned Projects
          </span>
        </div>

        {loadingPinned ? (
          <div className="px-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-surface-hover animate-pulse" />
                <div className="flex-1 h-3 rounded bg-surface-hover animate-pulse" />
              </div>
            ))}
          </div>
        ) : !pinnedProjects?.length ? (
          <div className="px-3 py-6 text-center">
            <svg className="w-10 h-10 mx-auto mb-2 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <p className="text-xs text-tertiary">Search and pin projects<br />to see their pipelines</p>
          </div>
        ) : (
          <div>
            {pinnedProjects.map((project) => {
              const { namespace, project: projectName } = splitPath(project.path_with_namespace);
              const isSelected = selectedProjectId === project.project_id;
              return (
                <div
                  key={project.project_id}
                  onClick={() => handleSelectProject(project.project_id)}
                  className={`flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer group ${
                    isSelected ? 'bg-surface-hover' : ''
                  }`}
                >
                  {/* Selection indicator */}
                  <div className={`w-0.5 h-5 rounded-full flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-accent' : 'bg-transparent'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      <span className="text-tertiary text-xs">{namespace}</span>
                      <span className={`font-medium ${isSelected ? 'text-primary' : 'text-secondary'}`}>
                        {projectName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(project);
                    }}
                    className="flex-shrink-0 text-caution opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-pointer transition-opacity"
                    title="Unpin project"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
