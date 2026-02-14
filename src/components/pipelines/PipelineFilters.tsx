/**
 * PipelineFilters - Filter bar for pipeline list
 */

import type { PipelineFilter, PipelineStatus } from '../../types/gitlab';
import { usePipelineStore } from '../../stores/pipelineStore';

const STATUS_OPTIONS: { value: PipelineStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'running', label: 'Running' },
  { value: 'pending', label: 'Pending' },
  { value: 'success', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'created', label: 'Created' },
  { value: 'waiting_for_resource', label: 'Waiting' },
  { value: 'preparing', label: 'Preparing' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'push', label: 'Push' },
  { value: 'web', label: 'Web' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'api', label: 'API' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'merge_request_event', label: 'Merge request' },
  { value: 'parent_pipeline', label: 'Parent pipeline' },
  { value: 'chat', label: 'Chat' },
];

export function PipelineFilters() {
  const { pipelineFilter, setPipelineFilter, resetPipelineFilter } = usePipelineStore();

  const hasFilters =
    pipelineFilter.ref_name || pipelineFilter.status || pipelineFilter.source || pipelineFilter.username;

  const updateFilter = (patch: Partial<PipelineFilter>) => {
    setPipelineFilter({ ...pipelineFilter, ...patch });
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-edge flex-wrap">
      <input
        type="text"
        placeholder="Branch..."
        value={pipelineFilter.ref_name || ''}
        onChange={(e) => updateFilter({ ref_name: e.target.value || undefined })}
        className="px-2 py-1 text-sm bg-canvas border border-edge rounded text-primary placeholder-tertiary focus:outline-none focus:border-accent w-32"
      />
      <select
        value={pipelineFilter.status || ''}
        onChange={(e) =>
          updateFilter({ status: (e.target.value as PipelineStatus) || undefined })
        }
        className="px-2 py-1 text-sm bg-canvas border border-edge rounded text-primary focus:outline-none focus:border-accent cursor-pointer"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={pipelineFilter.source || ''}
        onChange={(e) => updateFilter({ source: e.target.value || undefined })}
        className="px-2 py-1 text-sm bg-canvas border border-edge rounded text-primary focus:outline-none focus:border-accent cursor-pointer"
      >
        {SOURCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="User..."
        value={pipelineFilter.username || ''}
        onChange={(e) => updateFilter({ username: e.target.value || undefined })}
        className="px-2 py-1 text-sm bg-canvas border border-edge rounded text-primary placeholder-tertiary focus:outline-none focus:border-accent w-28"
      />
      {hasFilters && (
        <button
          onClick={resetPipelineFilter}
          className="px-2 py-1 text-xs text-secondary hover:text-primary cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
