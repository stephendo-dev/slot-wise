'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate } from '@/lib/api-client';
import { Alert } from './manager-ui';

export function CancelBooking({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCancel() {
    if (!window.confirm('Cancel this booking?')) return;
    setBusy(true);
    const result = await mutate('POST', `/public/bookings/${token}/cancel`);
    setBusy(false);
    if (result.ok) router.refresh();
    else setMessage(result.message);
  }

  return (
    <div className="mt-6 space-y-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-md border border-red-300 px-4 py-2 text-red-800 hover:bg-red-50 disabled:opacity-60"
      >
        Cancel booking
      </button>
      <Alert message={message} />
    </div>
  );
}
