import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** GET from the API with the browser's session cookie. A missing or dead session goes to /login. */
export async function apiGet<T>(path: string): Promise<T> {
  const cookie = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw new Error(`API ${path} answered ${res.status}`);
  return (await res.json()) as T;
}
