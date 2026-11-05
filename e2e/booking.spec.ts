import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const API = 'http://localhost:4000';

test('a customer books a free slot through the booking page and sees the confirmation', async ({
  page,
  request,
}) => {
  // An owner, one staff member who works every day, and one service, made through the API.
  const id = randomUUID().slice(0, 8);
  const signup = await request.post(`${API}/auth/signup`, {
    data: {
      email: `owner-${id}@example.com`,
      password: 'correct horse battery',
      businessName: `Browser Salon ${id}`,
      slug: `browser-${id}`,
      timeZone: 'Asia/Ho_Chi_Minh',
    },
  });
  expect(signup.status()).toBe(201);
  const cookie = signup.headers()['set-cookie']!.split(';')[0]!;
  const headers = { cookie };

  const staff = await (
    await request.post(`${API}/staff`, { headers, data: { name: 'Mai' } })
  ).json();
  await request.put(`${API}/staff/${staff.id}/hours`, {
    headers,
    data: {
      ranges: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        start: '09:00',
        end: '17:00',
      })),
    },
  });
  const service = await (
    await request.post(`${API}/services`, {
      headers,
      data: { name: 'Haircut', durationMinutes: 45, priceCents: 3500 },
    })
  ).json();
  await request.put(`${API}/services/${service.id}/staff`, {
    headers,
    data: { staffIds: [staff.id] },
  });

  await page.goto(`/b/browser-${id}`);
  await expect(
    page.getByRole('heading', { name: `Book at Browser Salon ${id}` }),
  ).toBeVisible();

  await page.getByRole('radio', { name: /Haircut/ }).check();
  await page.getByLabel('2. Choose who').selectOption({ label: 'Anyone' });
  await page.locator('input[name="slot"]').first().check({ force: true });

  await page.getByLabel('Name').fill('Linh Nguyen');
  await page.getByLabel('Email').fill('linh@example.com');
  await page.getByLabel('Phone').fill('+84 90 123 4567');
  await page.getByRole('button', { name: 'Book' }).click();

  await expect(
    page.getByRole('heading', { name: 'Booking confirmed' }),
  ).toBeVisible();
  await expect(page.getByText('Haircut', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('definition').filter({ hasText: 'Mai' }),
  ).toBeVisible();

  // The private link cancels the booking.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(
    page.getByRole('heading', { name: 'Booking cancelled' }),
  ).toBeVisible();
});
