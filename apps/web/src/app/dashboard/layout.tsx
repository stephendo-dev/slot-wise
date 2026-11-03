import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { getSession } from '@/lib/session';

async function Nav() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <DashboardNav role={session.user.role} business={session.business.name} />
  );
}

export default function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  return (
    <>
      <Suspense fallback={<div className="h-14 border-b border-slate-200" />}>
        <Nav />
      </Suspense>
      {children}
    </>
  );
}
