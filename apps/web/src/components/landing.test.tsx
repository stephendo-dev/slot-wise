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

  it('keeps the demo button disabled until the demo salon exists', () => {
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*>Try as business owner<\/button>/,
    );
  });

  it('links the source code', () => {
    expect(html).toContain('https://github.com/stephendo-dev/slot-wise');
  });
});
