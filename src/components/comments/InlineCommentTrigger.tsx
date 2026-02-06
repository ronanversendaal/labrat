/**
 * InlineCommentTrigger - "+" button that appears on line hover in diff view
 */

import clsx from 'clsx';

interface InlineCommentTriggerProps {
  /** Called when the trigger is clicked */
  onClick: () => void;
  /** Position style for the trigger */
  style?: React.CSSProperties;
  /** Whether the trigger is visible */
  visible?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * A small "+" button that appears on line hover to start a new comment
 */
export function InlineCommentTrigger({
  onClick,
  style,
  visible = true,
  className,
}: InlineCommentTriggerProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={style}
      className={clsx(
        'inline-flex items-center justify-center',
        'w-6 h-6 rounded-full',
        'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
        'text-white text-base font-bold leading-none',
        'shadow-md hover:shadow-lg',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
        'cursor-pointer select-none',
        className
      )}
      title="Add comment on this line"
      aria-label="Add comment on this line"
    >
      +
    </button>
  );
}

export default InlineCommentTrigger;
