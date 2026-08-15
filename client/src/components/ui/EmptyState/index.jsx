// DESIGN.md "States": "beautifully composed, indicate how to populate" — not a bare "no data".
export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-16 text-center ${className}`}>
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-outline">
          <Icon size={26} weight="regular" />
        </div>
      )}
      <div>
        <p className="text-base font-medium text-on-surface">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
