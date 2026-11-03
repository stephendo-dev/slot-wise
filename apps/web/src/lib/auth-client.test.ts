import { describe, expect, it } from 'vitest';
import { postAuth } from './auth-client';

const reply = (status: number, body?: unknown) =>
  (async () =>
    new Response(body ? JSON.stringify(body) : null, {
      status,
    })) as typeof fetch;

describe('postAuth', () => {
  it('is ok on a 2xx answer', async () => {
    expect(await postAuth('/api/auth/login', {}, reply(200, {}))).toEqual({
      ok: true,
    });
  });

  it('keeps the API’s message and the first message per field on a 400', async () => {
    const result = await postAuth(
      '/api/auth/signup',
      {},
      reply(400, {
        message: 'Check the form and try again',
        errors: [
          { field: 'password', message: 'Use at least 10 characters' },
          { field: 'password', message: 'second' },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      message: 'Check the form and try again',
      fields: { password: 'Use at least 10 characters' },
    });
  });

  it('puts a taken email on the email field and a taken address on the slug field', async () => {
    const email = await postAuth(
      '/api/auth/signup',
      {},
      reply(409, { message: 'An account with this email already exists' }),
    );
    const slug = await postAuth(
      '/api/auth/signup',
      {},
      reply(409, { message: 'This booking page address is already taken' }),
    );
    expect(email.ok === false && Object.keys(email.fields)).toEqual(['email']);
    expect(slug.ok === false && Object.keys(slug.fields)).toEqual(['slug']);
  });

  it('shows a plain message when the server cannot be reached', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const result = await postAuth('/api/auth/login', {}, down);
    expect(result.ok).toBe(false);
  });

  it('reads a non-JSON error without throwing', async () => {
    const result = await postAuth('/api/auth/login', {}, reply(502));
    expect(result).toMatchObject({ ok: false, message: expect.any(String) });
  });
});
