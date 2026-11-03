'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { postAuth } from '@/lib/auth-client';
import { buttonClass, Field } from './auth-form';

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const result = await postAuth('/api/auth/login', {
      email: data.get('email'),
      password: data.get('password'),
    });
    if (result.ok) {
      router.push('/dashboard');
      return;
    }
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
      />
      <p role="alert" className="text-sm text-red-700">
        {message}
      </p>
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
