import { forwardRef, useId } from 'react';

// Label above input, helper text optional, error text below — DESIGN.md "Input Fields" /
// "Data & Form Patterns". No placeholder-as-label, ever: `label` is required content, not the
// placeholder prop.
export const Input = forwardRef(function Input(
  {
    label,
    helperText,
    error,
    leadingIcon: LeadingIcon,
    trailingSlot,
    id,
    className = '',
    required = false,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-on-surface-variant">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>

      <div className="relative flex items-center">
        {LeadingIcon && (
          <LeadingIcon size={18} weight="regular" className="pointer-events-none absolute left-3 text-outline" />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperId}
          className={[
            'h-11 w-full rounded-(--radius-md) border bg-surface-container-lowest text-on-surface',
            'px-3 text-sm placeholder:text-outline/70 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            LeadingIcon ? 'pl-10' : '',
            trailingSlot ? 'pr-10' : '',
            error
              ? 'border-error focus:border-error focus:ring-error/15'
              : 'border-outline-variant focus:border-primary focus:ring-primary/15',
          ].join(' ')}
          {...props}
        />
        {trailingSlot && <div className="absolute right-2 flex items-center">{trailingSlot}</div>}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-outline">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
