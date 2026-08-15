// Chips / status badges — DESIGN.md "Chips" + "Sentiment Indicators". `tone` picks a
// semantic token pair; never color alone (FRONTEND.md §8) — always render with a label.
const TONES = {
  neutral: 'bg-surface-container text-on-surface-variant',
  primary: 'bg-primary-container/25 text-primary',
  secondary: 'bg-secondary-container/25 text-secondary',
  success: 'bg-success-container text-on-success-container',
  error: 'bg-error-container text-on-error-container',
};

export function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      ].join(' ')}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export default Badge;
