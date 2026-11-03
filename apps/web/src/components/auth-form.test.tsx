import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Field } from './auth-form';
import { LoginForm } from './login-form';
import { SignupForm } from './signup-form';

describe('Field', () => {
  it('ties the label, the hint and the error to the input', () => {
    const html = renderToStaticMarkup(
      <Field
        id="email"
        label="Email"
        hint="Work email"
        error="Enter a valid email"
      />,
    );
    expect(html).toContain('<label for="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error email-hint"');
    expect(html).toContain('id="email-error"');
  });
});

describe('forms', () => {
  it('login asks for an email and a password, both labelled', () => {
    const html = renderToStaticMarkup(<LoginForm />);
    for (const id of ['email', 'password']) {
      expect(html).toContain(`<label for="${id}"`);
    }
    expect(html).toMatch(/autocomplete="current-password"/i);
  });

  it('sign-up asks for the business, address, email, password and time zone', () => {
    const html = renderToStaticMarkup(<SignupForm />);
    for (const id of [
      'businessName',
      'slug',
      'email',
      'password',
      'timeZone',
    ]) {
      expect(html).toContain(`<label for="${id}"`);
    }
    expect(html).toMatch(/autocomplete="new-password"/i);
  });
});
