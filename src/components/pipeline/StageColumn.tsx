import type { PipelineJob, PipelineStage } from '../../types';
import { PipelineStatusIcon } from './PipelineStatusIcon';
import { JobRow } from './JobRow';

interface StageColumnProps {
  projectId: number;
  pipelineId: number;
  stage: PipelineStage;
  expandedJobId: number | null;
  onSelectJob: (job: PipelineJob | null) => void;
}

export function StageColumn({ projectId, pipelineId, stage, expandedJobId, onSelectJob }: StageColumnProps) {
  return (
    <div className="flex flex-col min-w-[180px] max-w-[260px]">
      {/* Stage header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-edge">
        <PipelineStatusIcon status={stage.status} size={14} />
        <span className="text-xs font-semibold text-content-secondary uppercase tracking-wide truncate">
          {stage.name}
        </span>
        <span className="text-xs text-content-tertiary ml-auto">{stage.jobs.length}</span>
      </div>

      {/* Jobs list */}
      <div className="flex flex-col gap-0.5 p-1">
        {stage.jobs.map((job) => (
          <JobRow
            key={job.id}
            projectId={projectId}
            pipelineId={pipelineId}
            job={job}
            isExpanded={expandedJobId === job.id}
            onSelect={onSelectJob}
          />
        ))}
      </div>
    </div>
  );
}
