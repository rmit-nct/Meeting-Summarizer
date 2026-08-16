import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';
import './auth.css';

export default function Signup() {
  const signUp = useAuthStore((state) => state.signUp); const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await signUp(form.email, form.password, form.name); navigate('/meetings'); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><h1>Create account</h1><p>Start turning meetings into clear action items.</p>
    <label>Name<input required maxLength="100" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
    <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
    <label>Password<input type="password" required minLength="8" maxLength="128" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    <p>Already registered? <Link to="/login">Sign in</Link></p></form></main>;
}
