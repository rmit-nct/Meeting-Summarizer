import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { User, Envelope, WarningCircle } from '@phosphor-icons/react';
import AuthLayout from '../../components/layout/AuthLayout/index.jsx';
import Input from '../../components/ui/Input/index.jsx';
import PasswordInput from '../../components/ui/PasswordInput/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const schema = z
  .object({
    username: z.string().min(2, 'Username must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function Signup() {
  const navigate = useNavigate();
  const { signUp, isAuthenticating } = useAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', confirmPassword: '' });
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
      await signUp(result.data.email, result.data.password, result.data.username);
      navigate('/meetings', { replace: true });
    } catch (err) {
      setFormError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start turning meetings into summaries."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
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
          label="Username"
          autoComplete="username"
          placeholder="johndoe"
          leadingIcon={User}
          required
          value={values.username}
          onChange={update('username')}
          error={fieldErrors.username?.[0]}
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={Envelope}
          required
          value={values.email}
          onChange={update('email')}
          error={fieldErrors.email?.[0]}
        />

        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          value={values.password}
          onChange={update('password')}
          error={fieldErrors.password?.[0]}
        />

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword?.[0]}
        />

        <Button type="submit" fullWidth loading={isAuthenticating}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
