import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { StaffView } from '@slotwise/shared';
import { StaffManager } from '@/components/staff-manager';
import { apiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Staff', robots: { index: false } };

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
      <Suspense fallback={<p className="mt-6 text-slate-600">Loading…</p>}>
        <Staff />
      </Suspense>
    </main>
  );
}

async function Staff() {
  const session = await getSession();
  if (session?.user.role !== 'owner') redirect('/dashboard');
  const staff = await apiGet<StaffView[]>('/staff');
  return (
    <div className="mt-6">
      <StaffManager staff={staff} />
    </div>
  );
}
