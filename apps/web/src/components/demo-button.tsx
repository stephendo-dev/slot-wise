'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate } from '@/lib/api-client';

/** Signs the visitor in as the demo owner and opens the dashboard: no form. */
export function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function onClick() {
    setBusy(true);
    setMessage('');
    const result = await mutate('POST', '/demo/login');
    if (result.ok) {
      router.push('/dashboard');
      return;
    }
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-md bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:opacity-70"
      >
        Try as business owner
      </button>
      <p role="alert" className="w-full text-sm text-red-700">
        {message}
      </p>
    </>
  );
}
