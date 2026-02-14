/**
 * PipelineList - Pipeline list for selected project
 */

import { usePipelines } from '../../hooks/usePipeline';
import { usePipelineStore } from '../../stores/pipelineStore';
import { PipelineCard } from './PipelineCard';
import { PipelineFilters } from './PipelineFilters';
import { Skeleton } from '../common';

interface PipelineListProps {
  projectId: number;
  projectName: string;
}

export function PipelineList({ projectId, projectName }: PipelineListProps) {
  const { pipelineFilter } = usePipelineStore();
  const { data: pipelines, isLoading } = usePipelines(projectId, pipelineFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <h2 className="text-sm font-semibold text-primary truncate">{projectName}</h2>
        <span className="text-xs text-tertiary">
          {pipelines ? `${pipelines.length} pipelines` : ''}
        </span>
      </div>

      {/* Filters */}
      <PipelineFilters />

      {/* List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="circular" width={20} height={20} />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="30%" />
                </div>
              </div>
            ))}
          </div>
        ) : !pipelines?.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-secondary">
            <svg className="w-10 h-10 mb-2 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No pipelines found</p>
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {pipelines.map((pipeline) => (
              <PipelineCard key={pipeline.id} pipeline={pipeline} projectId={projectId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
