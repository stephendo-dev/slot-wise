import 'server-only';
import { cookies } from 'next/headers';
import type { SessionInfo } from '@slotwise/shared';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** The signed-in user and business, or null. Forwards the browser's session cookie to the API. */
export async function getSession(): Promise<SessionInfo | null> {
  const cookie = (await cookies()).toString();
  if (!cookie) return null;
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie },
    cache: 'no-store',
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as SessionInfo;
}
