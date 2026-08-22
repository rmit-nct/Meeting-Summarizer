import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { Envelope, WarningCircle } from '@phosphor-icons/react';
import AuthLayout from '../../components/layout/AuthLayout/index.jsx';
import Input from '../../components/ui/Input/index.jsx';
import PasswordInput from '../../components/ui/PasswordInput/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useUiStore } from '../../stores/ui.store.js';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticating } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);
  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const update = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const result = schema.safeParse(values);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});

    try {
      await signIn(result.data);
      navigate('/meetings', { replace: true });
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your meetings."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-(--radius-lg) border border-error/30 bg-error-container/40 p-3 text-sm text-on-error-container">
            <WarningCircle size={18} weight="regular" className="mt-0.5 shrink-0" />
            {formError}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={Envelope}
          required
          value={values.email}
          onChange={update('email')}
          error={fieldErrors.email?.[0]}
        />

        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={values.password}
            onChange={update('password')}
            error={fieldErrors.password?.[0]}
          />
          <button
            type="button"
            onClick={() => pushToast({ tone: 'neutral', message: "Password reset isn't connected yet." })}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" fullWidth loading={isAuthenticating}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
