export const APP_NAME = 'SlotWise';

export const APP_TAGLINE = 'Online booking for small service businesses';

export const SOURCE_URL = 'https://github.com/stephendo-dev/slot-wise';

/**
 * The address part of a public booking page, `/b/<slug>`, from a business name:
 * lower case, ASCII letters and digits, words joined by single hyphens, at most 48 characters.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

export * from './auth.js';
export * from './management.js';
