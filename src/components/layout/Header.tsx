import { type ReactNode } from 'react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function Header({ title, subtitle, actions, children }: HeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-surface border-b border-edge">
      <div className="flex items-center gap-4">
        {(title || subtitle) && (
          <div>
            {title && (
              <h1 className="text-lg font-semibold text-content">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-content-secondary">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}

interface HeaderSearchProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export function HeaderSearch({
  placeholder = 'Search...',
  value,
  onChange,
  onSubmit,
}: HeaderSearchProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-64 pl-10 pr-4 py-1.5 text-sm
          bg-surface-alt
          border border-transparent
          rounded-md
          text-content
          placeholder-content-secondary
          focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
        "
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </form>
  );
}

interface HeaderButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  badge?: number;
}

export function HeaderButton({ icon, label, onClick, badge }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className="
        relative p-2 rounded-md
        text-content-secondary
        hover:text-content-muted
        hover:bg-surface-hover
        focus:outline-none focus:ring-2 focus:ring-ring
      "
      title={label}
      aria-label={label}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center text-xs font-medium bg-red-500 text-white rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
