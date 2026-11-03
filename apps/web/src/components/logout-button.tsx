'use client';

import { useRouter } from 'next/navigation';
import { postLogout } from '@/lib/auth-client';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
      onClick={async () => {
        await postLogout();
        router.push('/login');
      }}
    >
      Sign out
    </button>
  );
}
