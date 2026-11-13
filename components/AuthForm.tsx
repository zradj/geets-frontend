'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { hasPendingInvite, setToken } from '@/lib/store';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegister && password !== confirm) return setError('passwords do not match');
    if (isRegister && password.length < 10) return setError('password must be at least 10 characters');
    setBusy(true);
    try {
      const { token } = await (isRegister ? api.register : api.login)(username.trim(), password);
      setToken(token);
      router.replace(hasPendingInvite() ? '/join/' : '/chat/');
    } catch (err) {
      setError(err instanceof Error ? err.message.toLowerCase() : 'something went wrong');
      setBusy(false);
    }
  };

  const input = 'w-full rounded border border-line bg-panel px-3 py-2 outline-none focus:border-accent';

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">geets</h1>
          <p className="text-sm text-dim">
            {isRegister ? 'create an account' : 'sign in'}. the login name is only a key to your account &mdash; nobody
            in any chat ever sees it.
          </p>
        </div>
        {error && <p className="rounded border border-danger/50 px-3 py-2 text-sm text-danger">{error}</p>}
        <input className={input} placeholder="login name" autoComplete="username" required minLength={3}
          maxLength={50} pattern="[A-Za-z0-9_.\-]+" title="letters, digits, . _ -" value={username}
          onChange={(e) => setUsername(e.target.value)} />
        <input className={input} type="password" placeholder="password (10+ characters)" required
          minLength={isRegister ? 10 : 1} maxLength={128}
          autoComplete={isRegister ? 'new-password' : 'current-password'} value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {isRegister && (
          <input className={input} type="password" placeholder="repeat password" required maxLength={128}
            autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
        <button disabled={busy} className="w-full rounded bg-accent px-3 py-2 font-medium text-black disabled:opacity-50">
          {busy ? '...' : isRegister ? 'create account' : 'sign in'}
        </button>
        <p className="text-sm text-dim">
          {isRegister ? 'already registered? ' : 'no account? '}
          <Link className="text-accent underline" href={isRegister ? '/login/' : '/register/'}>
            {isRegister ? 'sign in' : 'create one'}
          </Link>
        </p>
      </form>
    </main>
  );
}
