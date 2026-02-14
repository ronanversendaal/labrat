import type { PipelineStatus } from '../../types';

interface PipelineStatusIconProps {
  status: PipelineStatus;
  size?: number;
  className?: string;
}

const statusConfig: Record<PipelineStatus, { color: string; label: string }> = {
  success: { color: 'text-positive', label: 'Passed' },
  failed: { color: 'text-negative', label: 'Failed' },
  running: { color: 'text-info', label: 'Running' },
  pending: { color: 'text-caution', label: 'Pending' },
  canceled: { color: 'text-content-tertiary', label: 'Canceled' },
  skipped: { color: 'text-content-tertiary', label: 'Skipped' },
  manual: { color: 'text-content-secondary', label: 'Manual' },
  scheduled: { color: 'text-info', label: 'Scheduled' },
  created: { color: 'text-content-tertiary', label: 'Created' },
  waiting_for_resource: { color: 'text-caution', label: 'Waiting' },
  preparing: { color: 'text-caution', label: 'Preparing' },
  other: { color: 'text-content-tertiary', label: 'Unknown' },
};

export function PipelineStatusIcon({ status, size = 16, className = '' }: PipelineStatusIconProps) {
  const config = statusConfig[status];
  const isAnimated = status === 'running' || status === 'pending' || status === 'preparing';

  return (
    <span
      className={`inline-flex items-center justify-center ${config.color} ${className}`}
      title={config.label}
      role="img"
      aria-label={config.label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        className={isAnimated ? 'animate-spin' : ''}
        style={isAnimated ? { animationDuration: '2s' } : undefined}
      >
        {renderIcon(status)}
      </svg>
    </span>
  );
}

function renderIcon(status: PipelineStatus) {
  switch (status) {
    case 'success':
      // Checkmark in circle
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'failed':
      // X in circle
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case 'running':
      // Spinning partial circle
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
          <path d="M8 1a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case 'pending':
    case 'waiting_for_resource':
      // Dotted circle (waiting)
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
          <circle cx="5" cy="8" r="1" fill="currentColor" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
          <circle cx="11" cy="8" r="1" fill="currentColor" />
        </>
      );

    case 'canceled':
      // Circle with slash
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case 'skipped':
      // Skip arrows
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 5l3 3-3 3M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'manual':
      // Play button (manual trigger)
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M6.5 5v6l5-3z" fill="currentColor" />
        </>
      );

    case 'scheduled':
      // Clock
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );

    case 'created':
      // Empty circle (not yet started)
      return (
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      );

    case 'preparing':
      // Gear/cog spinning
      return (
        <>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      );

    case 'other':
    default:
      // Question mark in circle
      return (
        <>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <text x="8" y="11" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="bold">?</text>
        </>
      );
  }
}

export function getStatusLabel(status: PipelineStatus): string {
  return statusConfig[status]?.label ?? status;
}

export function getStatusColorClass(status: PipelineStatus): string {
  return statusConfig[status]?.color ?? 'text-content-tertiary';
}
