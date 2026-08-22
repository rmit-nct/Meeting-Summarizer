import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';

// The one button component for the app. Variants mirror the "Primary / Secondary / Inverted /
// Outlined" set in .claude/references/style.png; colors come from Serene Protocol tokens, not
// the literal screenshot hex values (DESIGN.md picked accessible token variants instead).
const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary/40 disabled:bg-primary/40',
  secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high focus-visible:ring-outline/40 disabled:text-on-surface-variant/40',
  outline: 'border border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-low focus-visible:ring-outline/40 disabled:text-on-surface-variant/40',
  ghost: 'bg-transparent text-on-surface hover:bg-surface-container-low focus-visible:ring-outline/40 disabled:text-on-surface-variant/40',
  inverted: 'bg-on-surface text-surface hover:bg-on-surface/90 focus-visible:ring-on-surface/40 disabled:bg-on-surface/40',
  danger: 'bg-error text-on-error hover:bg-error/90 focus-visible:ring-error/40 disabled:bg-error/40',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    to,
    href,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = [
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-(--radius-md)',
    'font-medium transition-all duration-150 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  const content = (
    <>
      {loading ? (
        <CircleNotch size={16} weight="bold" className="animate-spin" />
      ) : (
        LeadingIcon && <LeadingIcon size={18} weight="regular" />
      )}
      {children}
      {!loading && TrailingIcon && <TrailingIcon size={18} weight="regular" />}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-disabled={disabled} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});

export default Button;
