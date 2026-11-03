export type Mutation =
  { ok: true; body: unknown } | { ok: false; message: string };

/** A change request from the browser to the API through the `/api` rewrite. */
export async function mutate(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  send: typeof fetch = fetch,
): Promise<Mutation> {
  let res: Response;
  try {
    res = await send(`/api${path}`, {
      method,
      headers:
        body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      message: 'Could not reach the server. Try again in a moment.',
    };
  }
  const parsed = (await res.json().catch(() => ({}))) as {
    message?: string;
    errors?: { message: string }[];
  };
  if (res.ok) return { ok: true, body: parsed };
  const detail = parsed.errors?.[0]?.message;
  return {
    ok: false,
    message: detail ?? parsed.message ?? 'Something went wrong. Try again.',
  };
}
