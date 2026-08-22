// DESIGN.md "Elevation & Depth": tonal layers + a soft ambient shadow, hairline border,
// never pure-black shadow. `interactive` adds hover/press affordance for clickable cards
// (meeting rows) without introducing a second elevation system.
export function Card({ interactive = false, padding = 'md', className = '', children, ...props }) {
  const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div
      className={[
        'rounded-(--radius-card) border border-outline-variant/50 bg-surface-container-lowest',
        'shadow-[0_4px_20px_-2px_rgba(27,27,27,0.05)]',
        paddings[padding],
        interactive
          ? 'cursor-pointer transition-all duration-150 hover:border-outline-variant hover:shadow-[0_8px_28px_-4px_rgba(27,27,27,0.08)] active:scale-[0.995]'
          : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
