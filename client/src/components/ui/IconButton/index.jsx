import { forwardRef } from 'react';

const SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10' };

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, size = 'md', label, active = false, className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active ? 'bg-primary-container/25 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      <Icon size={20} weight="regular" />
    </button>
  );
});

export default IconButton;
