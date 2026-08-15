// Initials avatar — DESIGN.md doesn't mandate photo avatars, and inventing fake profile photos
// for placeholder users is its own AI tell. Initials on a tonal primary fill keeps it honest.
function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({ name, size = 'md', className = '' }) {
  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center rounded-full bg-primary-container/30 font-semibold text-primary',
        SIZES[size],
        className,
      ].join(' ')}
      title={name}
    >
      {initialsOf(name)}
    </div>
  );
}

export default Avatar;
