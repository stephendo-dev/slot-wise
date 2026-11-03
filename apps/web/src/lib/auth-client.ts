export type AuthResult =
  { ok: true } | { ok: false; message: string; fields: Record<string, string> };

interface ErrorBody {
  message?: string;
  errors?: { field: string; message: string }[];
}

const FAILED: AuthResult = {
  ok: false,
  message: 'Could not reach the server. Try again in a moment.',
  fields: {},
};

/** Posts a sign-up or login form to the API through the `/api` rewrite and reads its errors. */
export async function postAuth(
  path: '/api/auth/signup' | '/api/auth/login',
  body: unknown,
  send: typeof fetch = fetch,
): Promise<AuthResult> {
  let res: Response;
  try {
    res = await send(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return FAILED;
  }
  if (res.ok) return { ok: true };

  const error = (await res.json().catch(() => ({}))) as ErrorBody;
  const fields: Record<string, string> = {};
  for (const item of error.errors ?? []) fields[item.field] ??= item.message;

  const message = error.message ?? 'Something went wrong. Try again.';
  if (res.status === 409) {
    fields[/email/i.test(message) ? 'email' : 'slug'] = message;
  }
  return { ok: false, message, fields };
}

export async function postLogout(send: typeof fetch = fetch): Promise<void> {
  await send('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}
