/**
 * PipelinesPage - Main Pipeline Browser page
 */

import { usePipelineStore } from '../../stores/pipelineStore';
import { usePinnedProjects } from '../../hooks/usePipeline';
import { ProjectSidebar } from './ProjectSidebar';
import { PipelineList } from './PipelineList';

export function PipelinesPage() {
  const { selectedProjectId } = usePipelineStore();
  const { data: pinnedProjects } = usePinnedProjects();

  // Resolve project name for the selected project
  const selectedProject = pinnedProjects?.find((p) => p.project_id === selectedProjectId);
  const projectName = selectedProject?.path_with_namespace || `Project #${selectedProjectId}`;

  return (
    <div className="flex h-full">
      {/* Project sidebar */}
      <ProjectSidebar />

      {/* Pipeline content */}
      <div className="flex-1 overflow-hidden">
        {selectedProjectId ? (
          <PipelineList projectId={selectedProjectId} projectName={projectName} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-secondary">
            <svg className="w-16 h-16 mb-4 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium">Select a project</p>
            <p className="text-xs text-tertiary mt-1">
              Search and pin projects from the sidebar to browse their pipelines
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
