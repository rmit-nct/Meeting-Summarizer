import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';
import Logo from '../../components/ui/Logo/index.jsx';

// Lands here after an OAuth redirect. Real implementation exchanges the code via
// supabase.auth.exchangeCodeForSession(); until that's wired in, this just shows the
// intended UI state and bounces to the dashboard.
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/meetings', { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
      <Logo size="md" to={null} />
      <div className="flex items-center gap-3 text-on-surface-variant">
        <CircleNotch size={20} weight="bold" className="animate-spin" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
