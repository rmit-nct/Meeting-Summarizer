import Logo from '../../ui/Logo/index.jsx';

// Shared shell for Login/Signup — centered card on the soft-wash canvas, matching
// .claude/references/login.png and register.png.
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size="md" />
        {title && <h1 className="text-xl font-semibold text-on-surface">{title}</h1>}
        {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
      </div>

      <div className="w-full max-w-sm rounded-(--radius-card) border border-outline-variant/50 bg-surface-container-lowest p-8 shadow-[0_4px_20px_-2px_rgba(27,27,27,0.06)]">
        {children}
      </div>

      {footer && <p className="mt-6 text-sm text-on-surface-variant">{footer}</p>}
    </div>
  );
}

export default AuthLayout;
