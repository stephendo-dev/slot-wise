'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { mutate } from '@/lib/api-client';

/** Runs a change, reports its error in a live region, and refreshes the server data on success. */
export function useMutation() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(
    method: Parameters<typeof mutate>[0],
    path: string,
    body?: unknown,
  ): Promise<boolean> {
    setBusy(true);
    const result = await mutate(method, path, body);
    setBusy(false);
    setMessage(result.ok ? '' : result.message);
    if (result.ok) router.refresh();
    return result.ok;
  }

  return { run, message, busy, setMessage };
}

export function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-red-700">
      {message}
    </p>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <li className="rounded-md border border-slate-200 p-4">{children}</li>;
}

export const smallButton =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60';
