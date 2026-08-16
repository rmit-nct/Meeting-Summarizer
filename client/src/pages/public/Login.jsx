import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';
import './auth.css';

export default function Login() {
  const signIn = useAuthStore((state) => state.signIn); const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await signIn(form.email, form.password); navigate('/meetings'); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><h1>Welcome back</h1><p>Sign in to continue to your meetings.</p>
    <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p>New here? <Link to="/signup">Create an account</Link></p></form></main>;
}
