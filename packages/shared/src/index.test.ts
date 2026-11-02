import { slugify } from './index.js';

describe('slugify', () => {
  it('turns a business name into a booking page address', () => {
    expect(slugify('Luna Hair Studio')).toBe('luna-hair-studio');
  });

  it('drops accents and punctuation', () => {
    expect(slugify("  Café d'Élise & Co.  ")).toBe('cafe-d-elise-co');
  });

  it('keeps it at most 48 characters without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });
});
