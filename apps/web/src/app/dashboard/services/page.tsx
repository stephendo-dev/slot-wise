import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { ServiceView, StaffView } from '@slotwise/shared';
import { ServicesManager } from '@/components/services-manager';
import { apiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Services',
  robots: { index: false },
};

export default function ServicesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
      <Suspense fallback={<p className="mt-6 text-slate-600">Loading…</p>}>
        <Services />
      </Suspense>
    </main>
  );
}

async function Services() {
  const session = await getSession();
  if (session?.user.role !== 'owner') redirect('/dashboard');
  const [services, staff] = await Promise.all([
    apiGet<ServiceView[]>('/services'),
    apiGet<StaffView[]>('/staff'),
  ]);
  return (
    <div className="mt-6">
      <ServicesManager services={services} staff={staff} />
    </div>
  );
}
