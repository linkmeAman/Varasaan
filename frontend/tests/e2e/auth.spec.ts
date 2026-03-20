import { expect, test } from '@playwright/test';

import { createTestUser, loginThroughUi, registerThroughUi } from './helpers';

test('signup, verify, login, logout, and protected redirect work with cookie auth', async ({ browser, page }) => {
  const user = createTestUser('auth');

  await registerThroughUi(page, user);
  await loginThroughUi(page, user);

  await expect(page.getByRole('navigation', { name: /Dashboard navigation/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('navigation', { name: /Dashboard navigation/i })).toBeVisible();

  await page.goto('/dashboard/heartbeat');
  await expect(page.getByRole('heading', { name: 'Heartbeat' })).toBeVisible();

  await page.getByRole('button', { name: /Sign Out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  const guestPage = await browser.newPage();
  await guestPage.goto('/dashboard/heartbeat');
  await expect(guestPage).toHaveURL(/\/login\?next=/);
  await guestPage.close();
});
