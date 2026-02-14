/**
 * Pipeline data fetching hooks using TanStack Query
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../services/tauri';
import type {
  PipelineFilter,
  PipelineUpdateEvent,
  JobLogUpdateEvent,
} from '../types';

// Query keys for pipeline-related queries
export const pipelineQueryKeys = {
  pinnedProjects: ['pinnedProjects'] as const,
  projectSearch: (query: string) => ['projectSearch', query] as const,
  pipelines: (projectId: number, filter?: PipelineFilter) =>
    ['pipelines', projectId, filter] as const,
  pipelineDetail: (projectId: number, pipelineId: number) =>
    ['pipelineDetail', projectId, pipelineId] as const,
  pipelineStages: (projectId: number, pipelineId: number) =>
    ['pipelineStages', projectId, pipelineId] as const,
  jobLog: (projectId: number, jobId: number) =>
    ['jobLog', projectId, jobId] as const,
  testReport: (projectId: number, pipelineId: number) =>
    ['testReport', projectId, pipelineId] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to search for GitLab projects
 */
export function useProjectSearch(query: string) {
  return useQuery({
    queryKey: pipelineQueryKeys.projectSearch(query),
    queryFn: () => api.searchProjects(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30s — search results are relatively stable
  });
}

/**
 * Hook to get pinned projects
 */
export function usePinnedProjects() {
  return useQuery({
    queryKey: pipelineQueryKeys.pinnedProjects,
    queryFn: api.getPinnedProjects,
  });
}

/**
 * Hook to list pipelines for a project
 */
export function usePipelines(projectId: number, filter?: PipelineFilter) {
  return useQuery({
    queryKey: pipelineQueryKeys.pipelines(projectId, filter),
    queryFn: () => api.listPipelines(projectId, filter),
    enabled: projectId > 0,
    refetchInterval: 30 * 1000, // 30s — pipelines change frequently
  });
}

/**
 * Hook to get pipeline detail
 */
export function usePipelineDetail(projectId: number, pipelineId: number) {
  return useQuery({
    queryKey: pipelineQueryKeys.pipelineDetail(projectId, pipelineId),
    queryFn: () => api.getPipelineDetail(projectId, pipelineId),
    enabled: projectId > 0 && pipelineId > 0,
  });
}

/**
 * Hook to get pipeline stages and jobs
 */
export function usePipelineStages(projectId: number, pipelineId: number) {
  return useQuery({
    queryKey: pipelineQueryKeys.pipelineStages(projectId, pipelineId),
    queryFn: () => api.getPipelineStages(projectId, pipelineId),
    enabled: projectId > 0 && pipelineId > 0,
  });
}

/**
 * Hook to get a job's log output
 */
export function useJobLog(projectId: number, jobId: number) {
  return useQuery({
    queryKey: pipelineQueryKeys.jobLog(projectId, jobId),
    queryFn: () => api.getJobLog(projectId, jobId),
    enabled: projectId > 0 && jobId > 0,
  });
}

/**
 * Hook to get test report for a pipeline
 */
export function useTestReport(projectId: number, pipelineId: number) {
  return useQuery({
    queryKey: pipelineQueryKeys.testReport(projectId, pipelineId),
    queryFn: () => api.getTestReport(projectId, pipelineId),
    enabled: projectId > 0 && pipelineId > 0,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to pin a project
 */
export function usePinProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      path,
      name,
      webUrl,
      avatarUrl,
    }: {
      projectId: number;
      path: string;
      name: string;
      webUrl: string;
      avatarUrl?: string;
    }) => api.pinProject(projectId, path, name, webUrl, avatarUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.pinnedProjects });
    },
  });
}

/**
 * Hook to unpin a project
 */
export function useUnpinProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: number) => api.unpinProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.pinnedProjects });
    },
  });
}

/**
 * Hook to retry a pipeline
 */
export function useRetryPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, pipelineId }: { projectId: number; pipelineId: number }) =>
      api.retryPipeline(projectId, pipelineId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineDetail(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineStages(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: ['pipelines', variables.projectId],
      });
    },
  });
}

/**
 * Hook to cancel a pipeline
 */
export function useCancelPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, pipelineId }: { projectId: number; pipelineId: number }) =>
      api.cancelPipeline(projectId, pipelineId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineDetail(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineStages(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: ['pipelines', variables.projectId],
      });
    },
  });
}

/**
 * Hook to retry a job
 */
export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { projectId: number; jobId: number; pipelineId: number }) =>
      api.retryJob(vars.projectId, vars.jobId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineStages(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.jobLog(variables.projectId, variables.jobId),
      });
    },
  });
}

/**
 * Hook to cancel a job
 */
export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { projectId: number; jobId: number; pipelineId: number }) =>
      api.cancelJob(vars.projectId, vars.jobId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineStages(variables.projectId, variables.pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.jobLog(variables.projectId, variables.jobId),
      });
    },
  });
}

/**
 * Hook to download job artifacts
 */
export function useDownloadArtifacts() {
  return useMutation({
    mutationFn: ({ projectId, jobId }: { projectId: number; jobId: number }) =>
      api.downloadArtifacts(projectId, jobId),
  });
}

// ============================================================================
// Event Subscriptions
// ============================================================================

/**
 * Hook to subscribe to pipeline update events via Tauri polling.
 * Starts polling on mount, stops on unmount, and updates query cache
 * when pipeline:update events are received.
 */
export function usePipelineUpdates(projectId: number, pipelineId: number) {
  const queryClient = useQueryClient();
  const [latestUpdate, setLatestUpdate] = useState<PipelineUpdateEvent | null>(null);

  const handleUpdate = useCallback(
    (event: PipelineUpdateEvent) => {
      setLatestUpdate(event);

      // Update the pipeline detail cache
      queryClient.setQueryData(
        pipelineQueryKeys.pipelineDetail(event.project_id, event.pipeline.id),
        event.pipeline
      );

      // Invalidate stages so they refetch with updated job statuses
      queryClient.invalidateQueries({
        queryKey: pipelineQueryKeys.pipelineStages(event.project_id, event.pipeline.id),
      });

      // Invalidate the pipelines list
      queryClient.invalidateQueries({
        queryKey: ['pipelines', event.project_id],
      });
    },
    [queryClient]
  );

  useEffect(() => {
    if (projectId <= 0 || pipelineId <= 0) return;
    if (!('__TAURI_INTERNALS__' in window)) return;

    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      // Start backend polling
      await api.startPipelinePolling(projectId, pipelineId);

      // Listen for update events
      unlisten = await listen<PipelineUpdateEvent>('pipeline:update', (event) => {
        handleUpdate(event.payload);
      });
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
      api.stopPipelinePolling(projectId, pipelineId);
    };
  }, [projectId, pipelineId, handleUpdate]);

  return { latestUpdate };
}

/**
 * Hook to subscribe to job log streaming events.
 * Starts streaming on mount, stops on unmount, and accumulates
 * log content as job:log_update events are received.
 */
export function useJobLogStream(projectId: number, jobId: number) {
  const [logContent, setLogContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const handleLogUpdate = useCallback((event: JobLogUpdateEvent) => {
    setLogContent(event.log_content);
    setIsComplete(event.is_complete);
  }, []);

  useEffect(() => {
    if (projectId <= 0 || jobId <= 0) return;
    if (!('__TAURI_INTERNALS__' in window)) return;

    let unlisten: UnlistenFn | null = null;

    // Reset state on new job
    setLogContent('');
    setIsComplete(false);

    const setup = async () => {
      // Start backend streaming
      await api.startJobLogStreaming(projectId, jobId);

      // Listen for log update events
      unlisten = await listen<JobLogUpdateEvent>('job:log_update', (event) => {
        if (event.payload.job_id === jobId) {
          handleLogUpdate(event.payload);
        }
      });
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
      api.stopJobLogStreaming(projectId, jobId);
    };
  }, [projectId, jobId, handleLogUpdate]);

  return { logContent, isComplete };
}
