import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLogin, useRegister } from '../api/hooks';
import type { AuthResponse } from '../api/types';
import { useAuthStore } from '../store/auth';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: 'demo@finsight.dev', password: 'demo12345' });

  if (token) return <Navigate to="/" replace />;

  const onSuccess = (res: AuthResponse) => {
    setSession(res.token, res.user);
    navigate('/');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') login.mutate({ email: form.email, password: form.password }, { onSuccess });
    else register.mutate(form, { onSuccess });
  };

  const mutation = mode === 'login' ? login : register;

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand brand-dark">
          <span className="brand-mark">◆</span> FinSight
        </div>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">Financial analytics for growing B2B teams.</p>

        {mode === 'register' && (
          <label>
            Company name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            minLength={8}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>

        {mutation.isError && <p className="error">{mutation.error?.message}</p>}

        <button className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'No account? Register' : 'Have an account? Sign in'}
        </button>
        {mode === 'login' && <p className="muted small">Demo: demo@finsight.dev / demo12345</p>}
      </form>
    </div>
  );
}
