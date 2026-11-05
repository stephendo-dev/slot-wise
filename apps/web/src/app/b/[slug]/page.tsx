import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { PublicBusiness } from '@slotwise/shared';
import { BookingFlow } from '@/components/booking-flow';
import { publicGet } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Book online' };

export default function BookingPage({ params }: PageProps<'/b/[slug]'>) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Suspense fallback={<p className="text-slate-600">Loading…</p>}>
        <Business params={params} />
      </Suspense>
    </main>
  );
}

async function Business({
  params,
}: {
  params: PageProps<'/b/[slug]'>['params'];
}) {
  const { slug } = await params;
  const business = await publicGet<PublicBusiness>(
    `/b/${encodeURIComponent(slug)}`,
  );
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Book at {business.name}
      </h1>
      <div className="mt-8">
        <BookingFlow business={business} />
      </div>
    </>
  );
}
