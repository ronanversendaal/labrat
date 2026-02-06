import { useState, useCallback } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

/**
 * Avatar component that displays a user's avatar image with graceful fallback.
 * Falls back to initials when:
 * - No avatar URL is provided
 * - The avatar URL fails to load (e.g., 401 for private GitLab avatars)
 */
export function Avatar({ src, name, size = 'sm', className = '', title }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const initials = getInitials(name);
  const sizeClass = sizeClasses[size];

  // Show image if we have a source URL and no error occurred
  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={name}
        title={title || name}
        onError={handleError}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  // Fallback to initials
  return (
    <div
      title={title || name}
      className={`${sizeClass} rounded-full bg-blue-500 flex items-center justify-center font-medium text-white ${className}`}
    >
      {initials}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}
