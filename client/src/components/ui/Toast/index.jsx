import { CheckCircle, WarningCircle, Info, X } from '@phosphor-icons/react';
import { useUiStore } from '../../../stores/ui.store.js';

const TONE_ICON = { success: CheckCircle, error: WarningCircle, neutral: Info };
const TONE_CLASS = {
  success: 'border-success/30 bg-surface-container-lowest text-on-surface [&_svg]:text-success',
  error: 'border-error/30 bg-surface-container-lowest text-on-surface [&_svg]:text-error',
  neutral: 'border-outline-variant bg-surface-container-lowest text-on-surface [&_svg]:text-outline',
};

// Mounted once in App.jsx. Transient failures only (DESIGN.md "States" — form errors stay
// inline, next to the field).
export function ToastViewport() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {toasts.map((toast) => {
        const Icon = TONE_ICON[toast.tone] ?? Info;
        return (
          <div
            key={toast.id}
            role="status"
            className={[
              'animate-fade-in-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-(--radius-lg) border p-4 shadow-[0_8px_28px_-4px_rgba(27,27,27,0.12)]',
              TONE_CLASS[toast.tone] ?? TONE_CLASS.neutral,
            ].join(' ')}
          >
            <Icon size={20} weight="regular" className="mt-0.5 shrink-0" />
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-outline transition-colors hover:text-on-surface"
              aria-label="Dismiss"
            >
              <X size={16} weight="regular" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastViewport;
