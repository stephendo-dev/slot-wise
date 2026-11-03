import { SESSION_TTL_MS } from './auth.service.js';

export const SESSION_COOKIE = 'sw_session';

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

// Nest's setCookie takes seconds.
export const sessionCookieMaxAgeSeconds = SESSION_TTL_MS / 1000;

/** The value of one cookie from a `Cookie` header, or undefined. */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    if (part.slice(0, at).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
