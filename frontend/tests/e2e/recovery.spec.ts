import { expect, test } from '@playwright/test';

import { API_BASE_URL, apiSignupVerifyLogin, createTestUser, extractDebugCode, loginThroughUi } from './helpers';

test('password reset completes and the new password can be used to log in', async ({ page, request }) => {
  const user = createTestUser('reset');
  await apiSignupVerifyLogin(request, user);

  const updatedPassword = 'RecoveredPassw0rd!!456';

  await page.goto('/recovery');
  await page.getByLabel('Account Email').first().fill(user.email);
  await page.getByRole('button', { name: 'Request Reset Token' }).click();

  const resetToken = await extractDebugCode(page, 'Debug reset token:');
  await page.getByLabel('Reset Token').fill(resetToken);
  await page.getByLabel('New Password').fill(updatedPassword);
  await page.getByRole('button', { name: 'Complete Password Reset' }).click();

  await expect(page.getByText('Password reset completed')).toBeVisible();
  await loginThroughUi(page, { ...user, password: updatedPassword });
});

test('assisted trusted-contact recovery completes and rotates credentials', async ({ page, request }) => {
  const owner = createTestUser('assist-owner');
  const ownerSession = await apiSignupVerifyLogin(request, owner);
  const trustedContactEmail = createTestUser('assist-helper').email;
  const updatedPassword = 'AssistedPassw0rd!!789';

  const authHeaders = { Authorization: `Bearer ${ownerSession.access_token}` };

  const createContactResponse = await request.post(`${API_BASE_URL}/api/v1/trusted-contacts`, {
    headers: authHeaders,
    data: {
      name: 'Recovery Helper',
      email: trustedContactEmail,
      role: 'recovery_assist',
      recovery_enabled: true,
    },
  });
  expect(createContactResponse.ok()).toBeTruthy();
  const contact = await createContactResponse.json();

  const inviteResponse = await request.post(`${API_BASE_URL}/api/v1/trusted-contacts/${contact.id}/invite`, {
    headers: authHeaders,
    data: { force_reissue: true },
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const inviteBody = await inviteResponse.json();
  expect(inviteBody.invite_token).toBeTruthy();

  const acceptInviteResponse = await request.post(
    `${API_BASE_URL}/api/v1/trusted-contacts/invite/accept?token=${inviteBody.invite_token}`,
  );
  expect(acceptInviteResponse.ok()).toBeTruthy();

  await page.goto('/recovery');
  await page.getByLabel('Account Email').nth(1).fill(owner.email);
  await page.locator('#recovery-mode').selectOption('trusted_contact');
  await page.getByLabel('Trusted Contact Email').fill(trustedContactEmail);
  await page.getByRole('button', { name: 'Request Recovery' }).click();

  const recoveryToken = await extractDebugCode(page, 'Debug recovery token:');
  const approvalToken = await extractDebugCode(page, 'Debug approval token:');

  await page.getByLabel('Approval Token').fill(approvalToken);
  await page.getByRole('button', { name: /Approve Recovery/i }).click();
  await expect(page.getByText('Recovery request approved')).toBeVisible();

  await page.getByLabel('New Password').fill(updatedPassword);
  await page.getByLabel('Recovery Token').fill(recoveryToken);
  await page.getByRole('button', { name: 'Complete Recovery' }).click();

  await expect(page.getByText('Account recovery completed')).toBeVisible();
  await loginThroughUi(page, { ...owner, password: updatedPassword });
});
