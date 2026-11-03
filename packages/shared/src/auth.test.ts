import { describe, expect, it } from 'vitest';
import { isTimeZone, loginSchema, signupSchema } from './index.js';

const valid = {
  email: '  Owner@Example.COM ',
  password: 'correct horse battery',
  businessName: 'Luna Hair Studio',
  timeZone: 'Asia/Ho_Chi_Minh',
};

describe('signupSchema', () => {
  it('trims and lower-cases the email and keeps the slug optional', () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.email).toBe('owner@example.com');
    expect(parsed.slug).toBeUndefined();
  });

  it.each([
    ['a password under 10 characters', { password: 'too short' }],
    ['an email without a domain', { email: 'owner@' }],
    ['a slug with spaces', { slug: 'luna hair' }],
    ['a slug with a double hyphen', { slug: 'luna--hair' }],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }],
    ['a one-letter business name', { businessName: 'L' }],
  ])('refuses %s', (_name, change) => {
    expect(signupSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('needs only an email and a non-empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: '' }).success,
    ).toBe(false);
  });
});

describe('isTimeZone', () => {
  it('accepts IANA names and refuses the rest', () => {
    expect(isTimeZone('Europe/Paris')).toBe(true);
    expect(isTimeZone('Nope/Nowhere')).toBe(false);
  });
});
