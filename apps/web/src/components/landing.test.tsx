import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Landing, features, steps } from './landing';

describe('Landing', () => {
  const html = renderToStaticMarkup(<Landing />);

  it('has one main heading with the promise', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Let customers book you online');
  });

  it('shows the three steps and every feature', () => {
    expect(steps).toHaveLength(3);
    for (const item of [...steps, ...features]) {
      expect(html).toContain(item.title);
    }
  });

  it('keeps the demo button inactive but focusable until the demo salon exists', () => {
    expect(html).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*aria-describedby="demo-soon"[^>]*>Try as business owner<\/button>/,
    );
    expect(html).not.toMatch(/<button[^>]*\sdisabled[\s=>]/);
  });

  it('links to sign-up and login', () => {
    expect(html).toMatch(/<a[^>]*href="\/signup"[^>]*>Get started<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/login"[^>]*>Sign in<\/a>/);
  });

  it('links the source code', () => {
    expect(html).toContain('https://github.com/stephendo-dev/slot-wise');
  });
});
