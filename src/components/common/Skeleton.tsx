interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-surface-alt';

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Preset skeleton components for common use cases
Skeleton.Text = function SkeletonText({
  lines = 1,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
          height="1em"
        />
      ))}
    </div>
  );
};

Skeleton.Avatar = function SkeletonAvatar({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
    />
  );
};

Skeleton.Card = function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`p-4 border border-edge rounded-lg ${className}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton.Avatar size={40} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" height="1rem" className="mb-2" />
          <Skeleton variant="text" width="40%" height="0.75rem" />
        </div>
      </div>
      <Skeleton.Text lines={3} />
    </div>
  );
};

Skeleton.List = function SkeletonList({
  items = 3,
  className = '',
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton.Avatar size={32} />
          <Skeleton variant="text" className="flex-1" />
        </div>
      ))}
    </div>
  );
};
