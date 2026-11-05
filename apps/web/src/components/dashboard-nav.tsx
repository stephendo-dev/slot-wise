import Link from 'next/link';
import type { Role } from '@slotwise/shared';
import { LogoutButton } from './logout-button';

const linkClass =
  'rounded-md px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100';

export function DashboardNav({
  role,
  business,
}: {
  role: Role;
  business: string;
}) {
  return (
    <header className="border-b border-slate-200">
      <nav
        aria-label="Dashboard"
        className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-3"
      >
        <span className="mr-4 font-semibold">{business}</span>
        <Link href="/dashboard" className={linkClass}>
          Overview
        </Link>
        <Link href="/dashboard/bookings" className={linkClass}>
          Bookings
        </Link>
        {role === 'owner' ? (
          <>
            <Link href="/dashboard/staff" className={linkClass}>
              Staff
            </Link>
            <Link href="/dashboard/services" className={linkClass}>
              Services
            </Link>
          </>
        ) : null}
        <span className="ml-auto">
          <LogoutButton />
        </span>
      </nav>
    </header>
  );
}
