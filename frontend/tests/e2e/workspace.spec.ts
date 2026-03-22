import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  apiSignupVerifyLogin,
  createTestUser,
  extractTokenFromFeedback,
  loginThroughUi,
  signWebhook,
} from './helpers';

const WEBHOOK_SECRET = process.env.E2E_RAZORPAY_WEBHOOK_SECRET || 'whsec_test';

test('inventory, contacts, documents, packets, exports, and billing flows work end to end', async ({
  page,
  request,
}) => {
  const user = createTestUser('workspace-owner');
  await apiSignupVerifyLogin(request, user);
  await loginThroughUi(page, user);

  await page.goto('/dashboard/inventory');
  await page.getByRole('button', { name: /Add Account/i }).first().click();
  await page.getByLabel('Platform').fill('Gmail');
  await page.getByLabel('Category').fill('communication');
  await page.getByLabel('Username Hint').fill(user.email);
  await page.getByLabel('Importance (1-5)').fill('4');
  await page.getByRole('button', { name: /^Add Account$/ }).last().click();
  await expect(page.getByText('Account added to backend inventory.')).toBeVisible();

  const gmailRow = page.locator('.inventory-item').filter({ hasText: 'Gmail' }).first();
  await gmailRow.getByRole('button', { name: /Edit/i }).click();
  await page.getByLabel('Platform').fill('Google Workspace');
  await page.getByLabel('Importance (1-5)').fill('5');
  await page.getByRole('button', { name: /Update Account/i }).click();
  await expect(page.getByText('Inventory account updated.')).toBeVisible();

  const workspaceRow = page.locator('.inventory-item').filter({ hasText: 'Google Workspace' }).first();
  await workspaceRow.getByRole('button', { name: /Delete/i }).click();
  await expect(page.getByText('Inventory account deleted.')).toBeVisible();
  await expect(page.locator('.inventory-item').filter({ hasText: 'Google Workspace' })).toHaveCount(0);

  const inviteContactEmail = createTestUser('invite-contact').email;
  await page.goto('/dashboard/trusted-contacts');
  await page.getByLabel('Name').fill('Invite Helper');
  await page.getByLabel('Email').fill(inviteContactEmail);
  await page.locator('#trusted-role').selectOption('recovery_assist');
  await page.getByLabel('Enable for account recovery').check();
  await page.getByRole('button', { name: /Add Contact/i }).click();
  await expect(page.getByText('Trusted contact created.')).toBeVisible();

  const inviteRow = page.locator('.inventory-item').filter({ hasText: inviteContactEmail }).first();
  await inviteRow.getByRole('button', { name: /Invite/i }).click();
  await expect(page.locator('.inventory-feedback')).toContainText('Debug token:');
  const inviteFeedback = (await page.locator('.inventory-feedback').textContent()) || '';
  const inviteToken = extractTokenFromFeedback(inviteFeedback, 'Debug token:');

  await page.getByLabel('Invite Token').fill(inviteToken);
  await page.getByRole('button', { name: /^Accept$/ }).click();
  await expect(page.locator('.inventory-item').filter({ hasText: inviteContactEmail })).toContainText('active');

  await inviteRow.getByRole('button', { name: /Revoke/i }).click();
  await page.getByLabel('Type contact name').fill('Invite Helper');
  await page.getByRole('button', { name: /Revoke Contact/i }).click();
  await expect(page.getByText('Trusted contact revoked.')).toBeVisible();
  await expect(page.locator('.inventory-item').filter({ hasText: inviteContactEmail })).toContainText('revoked');

  const grantContactEmail = createTestUser('grant-contact').email;
  await page.getByLabel('Name').fill('Grant Helper');
  await page.getByLabel('Email').fill(grantContactEmail);
  await page.locator('#trusted-role').selectOption('viewer');
  await page.getByLabel('Enable for account recovery').uncheck();
  await page.getByRole('button', { name: /Add Contact/i }).click();
  await expect(page.getByText('Trusted contact created.')).toBeVisible();

  const grantRow = page.locator('.inventory-item').filter({ hasText: grantContactEmail }).first();
  await grantRow.getByRole('button', { name: /Invite/i }).click();
  await expect(page.locator('.inventory-feedback')).toContainText('Debug token:');
  const grantFeedback = (await page.locator('.inventory-feedback').textContent()) || '';
  const grantInviteToken = extractTokenFromFeedback(grantFeedback, 'Debug token:');

  await page.getByLabel('Invite Token').fill(grantInviteToken);
  await page.getByRole('button', { name: /^Accept$/ }).click();
  await expect(page.locator('.inventory-item').filter({ hasText: grantContactEmail })).toContainText('active');

  await page.goto('/dashboard/documents');
  await page.getByLabel('Document Type').fill('death_certificate');
  await page.getByLabel('Document File').setInputFiles({
    name: 'sample-document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf-8'),
  });
  await page.getByRole('button', { name: /Upload and Scan/i }).click();
  await expect(page.getByText('Document uploaded and scan queued.')).toBeVisible();

  const documentRow = page.locator('.inventory-item').filter({ hasText: 'death_certificate' }).first();
  const documentId = ((await documentRow.locator('h4').textContent()) || '').trim();
  expect(documentId).not.toBe('');

  await expect(documentRow).toContainText('clean');
  await page.locator('#grant-document').selectOption({ index: 1 });
  await page.locator('#grant-contact').selectOption({ label: `Grant Helper (${grantContactEmail})` });
  await page.getByLabel('Reason').fill('Executor access');
  await page.getByRole('button', { name: /Create Grant/i }).click();
  await expect(page.getByText('Document grant created.')).toBeVisible();

  const [documentDownloadApiResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/documents/${documentId}/download`) &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    ),
    documentRow.getByRole('button', { name: /Download/i }).click(),
  ]);
  const documentDownloadPayload = (await documentDownloadApiResponse.json()) as { download_url: string };
  expect(documentDownloadPayload.download_url).toMatch(/\/api\/v1\/testing\/storage\/download/);
  const documentDownloadResponse = await request.get(documentDownloadPayload.download_url);
  expect(documentDownloadResponse.ok()).toBeTruthy();

  await page.goto('/dashboard/packets');
  await page.getByRole('button', { name: /Queue Packet Job/i }).click();
  await expect(page.getByText('Packet generation job queued.')).toBeVisible();
  await expect(page.locator('.inventory-item')).toContainText('ready');

  await page.goto('/dashboard/exports');
  await page.getByRole('button', { name: /Create Export Job/i }).click();
  await expect(page.getByText('Export job queued.')).toBeVisible();

  const exportRow = page.locator('.inventory-item').filter({ hasText: 'export' }).first();
  const exportJobId = ((await exportRow.locator('h4').textContent()) || '').trim();
  expect(exportJobId).not.toBe('');

  const [exportDownloadApiResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/exports/${exportJobId}/download-by-token`) &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    ),
    exportRow.getByRole('button', { name: /Token Download/i }).click(),
  ]);
  const exportDownloadPayload = (await exportDownloadApiResponse.json()) as { download_url: string };
  expect(exportDownloadPayload.download_url).toMatch(/\/api\/v1\/testing\/storage\/download/);
  const exportDownloadResponse = await request.get(exportDownloadPayload.download_url);
  expect(exportDownloadResponse.ok()).toBeTruthy();

  await expect(page.locator('.inventory-feedback')).toContainText('One-time token used:');
  const exportFeedback = (await page.locator('.inventory-feedback').textContent()) || '';
  const oneTimeToken = extractTokenFromFeedback(exportFeedback, 'One-time token used:');

  const replayResponse = await request.get(
    `${API_BASE_URL}/api/v1/exports/${exportJobId}/download-by-token?token=${oneTimeToken}`,
  );
  expect(replayResponse.status()).toBe(410);

  await page.goto('/dashboard/heartbeat');
  await page.locator('#heartbeat-cadence').selectOption('quarterly');
  await page.getByRole('button', { name: /Save cadence/i }).click();
  await expect(page.getByText('Heartbeat schedule saved.')).toBeVisible();
  await expect(page.getByText(/Next expected check-in/i)).toBeVisible();
  await page.getByRole('button', { name: /Check in now/i }).click();
  await expect(page.getByText('Heartbeat check-in recorded.')).toBeVisible();

  await page.goto('/dashboard/billing');
  await page.getByRole('button', { name: /Create Order/i }).click();
  await expect(page.getByText('provider: razorpay')).toBeVisible();

  const paymentRow = page.locator('.inventory-item').filter({ hasText: 'provider: razorpay' }).first();
  const orderId = ((await paymentRow.locator('h4').textContent()) || '').trim();
  expect(orderId).not.toBe('');

  const payload = {
    event_id: `evt-${Date.now()}`,
    order_id: orderId,
    payment_id: `pay-${Date.now()}`,
    status: 'captured',
    event_sequence: 1,
  };
  const webhook = signWebhook(payload, WEBHOOK_SECRET);
  const webhookResponse = await request.post(`${API_BASE_URL}/api/v1/payments/webhook`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Razorpay-Signature': webhook.signature,
    },
    data: webhook.raw,
  });
  expect(webhookResponse.ok()).toBeTruthy();

  await page.getByRole('button', { name: /Verify Status|Verifying/i }).click();
  await expect(page.getByText(/captured \(seq 1\)/)).toBeVisible();
});
