import { expect, test } from '@playwright/test';

import { playwrightApiBaseUrl, playwrightInternalApiKey } from './env';
import { apiSignupVerifyLogin, createTestUser, extractTokenFromFeedback, loginThroughUi } from './helpers';

const REVIEW_PENDING_CERTIFICATE = Buffer.from(
  '%PDF-1.1\n1 0 obj\n<< /Title (Executor Copy) /Author (Scanner Device) >>\nendobj\ntrailer\n<<>>\n%%EOF\n',
  'utf-8',
);
const CLEAN_CERTIFICATE = Buffer.from('%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf-8');
const CLEAN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
);
test('executor can activate a pending case and manage generated tasks', async ({ page, request }) => {
  const owner = createTestUser('executor-owner');
  const executor = createTestUser('executor-user');

  await apiSignupVerifyLogin(request, owner);
  await apiSignupVerifyLogin(request, executor);

  await loginThroughUi(page, owner);

  await page.goto('/dashboard/inventory');
  await page.getByRole('button', { name: /Add Account/i }).click();
  await page.getByLabel('Platform').fill('Dropbox');
  await page.getByLabel('Category').fill('storage');
  await page.getByLabel('Username Hint').fill(owner.email);
  await page.getByLabel('Importance (1-5)').fill('2');
  await page.getByLabel('Recurring payment').check();
  await page.getByLabel('Payment Rail').selectOption('card');
  await page.getByLabel('Monthly Amount (INR)').fill('799.00');
  await page.getByLabel('Payment Reference Hint').fill('VISA 1234');
  await page.getByRole('button', { name: /^Add Account$/ }).last().click();
  await expect(page.locator('.inventory-item').filter({ hasText: 'Dropbox' })).toHaveCount(1);
  await expect(page.locator('.inventory-item').filter({ hasText: 'Dropbox' })).toContainText('Recurring');
  await expect(page.locator('.inventory-item').filter({ hasText: 'Dropbox' })).toContainText('Card');
  await expect(page.locator('.inventory-item').filter({ hasText: 'Dropbox' })).toContainText('₹799.00 / month');

  await page.goto('/dashboard/trusted-contacts');
  await page.getByLabel('Name').fill('Executor User');
  await page.getByLabel('Email').fill(executor.email);
  await page.locator('#trusted-role').selectOption('executor');
  await page.getByLabel('Enable for account recovery').uncheck();
  await page.getByRole('button', { name: /Add Contact/i }).click();
  await expect(page.getByText('Trusted contact created.')).toBeVisible();

  const executorRow = page.locator('.inventory-item').filter({ hasText: executor.email }).first();
  await executorRow.getByRole('button', { name: /Invite/i }).click();
  await expect(page.locator('.inventory-feedback')).toContainText('Debug token:');
  const inviteFeedback = (await page.locator('.inventory-feedback').textContent()) || '';
  const inviteToken = extractTokenFromFeedback(inviteFeedback, 'Debug token:');

  await page.getByLabel('Invite Token').fill(inviteToken);
  await page.getByRole('button', { name: /^Accept$/ }).click();
  await expect(executorRow).toContainText('active');

  await page.getByRole('button', { name: /^Sign Out$/ }).click({ force: true });
  await expect(page).toHaveURL(/\/login/);
  await loginThroughUi(page, executor);

  await page.goto('/executor');
  await expect(page.getByRole('heading', { name: /Executor Cases/i })).toBeVisible();
  await expect(page.locator('.executor-case-card')).toContainText(owner.email);

  await page.getByLabel('Death Certificate PDF').setInputFiles({
    name: 'death-certificate.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf-8'),
  });
  await page.getByRole('button', { name: /Upload and Activate/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\//);

  await expect(page.locator('.executor-list-item').filter({ hasText: 'Dropbox' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Subscription Bleed Stopper' })).toBeVisible();
  await expect(page.locator('.bleed-stopper-panel')).toContainText('₹799.00');

  await page.locator('#case-filter-category').selectOption('storage');
  await expect(page.locator('.executor-list-item')).toHaveCount(1);
  await expect(page.locator('.executor-list-item')).toContainText('Dropbox');
  await expect(page.locator('.executor-list-item')).toContainText('Recurring: Card');

  await page.locator('.executor-list-item').getByRole('button', { name: /Edit Task/i }).click();
  const dialog = page.getByRole('dialog');
  const evidenceInput = dialog.locator('input[type="file"]');
  await dialog.getByLabel('Status').selectOption('submitted');
  await dialog.getByLabel('Reference Number').fill('REF-EXEC-001');
  await dialog.getByLabel('Submitted Date').fill('2026-03-21');
  await dialog.getByLabel('Notes').fill('Submitted through Dropbox support.');
  await dialog.getByRole('button', { name: /Save Task/i }).click();
  await expect(page.getByText('Task updated.')).toBeVisible();

  await evidenceInput.setInputFiles({
    name: 'dropbox-proof-1.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf-8'),
  });
  await expect(dialog.getByRole('button', { name: /Upload Evidence/i })).toBeEnabled();
  await dialog.getByRole('button', { name: /Upload Evidence/i }).click();
  await expect(dialog.getByText('dropbox-proof-1.pdf')).toBeVisible();
  await expect(dialog.getByText('Scan passed')).toBeVisible();
  await dialog.getByRole('button', { name: /^Close$/ }).click();

  await page.locator('.executor-list-item').getByRole('button', { name: /Edit Task/i }).click();
  const reopenedDialog = page.getByRole('dialog');
  const reopenedEvidenceInput = reopenedDialog.locator('input[type="file"]');
  await reopenedEvidenceInput.setInputFiles({
    name: 'dropbox-proof-2.png',
    mimeType: 'image/png',
    buffer: CLEAN_PNG,
  });
  await expect(reopenedDialog.getByRole('button', { name: /Upload Evidence/i })).toBeEnabled();
  await reopenedDialog.getByRole('button', { name: /Upload Evidence/i }).click();
  await expect(reopenedDialog.getByText('dropbox-proof-2.png')).toBeVisible();
  await expect(reopenedDialog.getByRole('button', { name: /Download/i })).toHaveCount(2);
  await reopenedDialog.getByRole('button', { name: /^Close$/ }).click();

  await page.getByRole('button', { name: /Subscription Bleed Stopper/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\/.+\/bleed-stopper/);
  await expect(page.getByRole('heading', { name: /Subscription Bleed Stopper/i })).toBeVisible();
  await expect(page.locator('article')).toContainText('Cancel card mandate and dispute debits');
  await expect(page.getByText('Printable Card Dispute Template')).toBeVisible();
  await expect(page.locator('article')).toContainText('VISA 1234');

  await page.evaluate(() => {
    (window as Window & { __bleedPrintCalls?: number }).__bleedPrintCalls = 0;
    window.print = () => {
      (window as Window & { __bleedPrintCalls?: number }).__bleedPrintCalls =
        ((window as Window & { __bleedPrintCalls?: number }).__bleedPrintCalls || 0) + 1;
    };
  });
  await page.getByRole('button', { name: /Print \/ Save as PDF/i }).click();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __bleedPrintCalls?: number }).__bleedPrintCalls || 0)).toBe(1);

  await page.getByRole('button', { name: /Back to Workspace/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\/[^/]+$/);

  await page.locator('#case-filter-status').selectOption('submitted');
  await expect(page.locator('.executor-list-item')).toHaveCount(1);
  await page.locator('.executor-list-item').getByRole('button', { name: /Edit Task/i }).click();
  const resolvedDialog = page.getByRole('dialog');
  await resolvedDialog.getByLabel('Status').selectOption('resolved');
  await resolvedDialog.getByRole('button', { name: /Save Task/i }).click();
  await expect(page.getByText('Task updated.')).toBeVisible();
  await resolvedDialog.getByRole('button', { name: /^Close$/ }).click();

  await page.locator('#case-filter-status').selectOption('resolved');
  await expect(page.locator('.executor-list-item')).toHaveCount(1);
  await expect(page.locator('.executor-list-item')).toContainText('REF-EXEC-001');
  await expect(page.locator('.executor-list-item')).toContainText('Submitted: 2026-03-21');
  await expect(page.locator('.executor-list-item')).toContainText('Submitted through Dropbox support.');
  await expect(page.locator('.executor-list-item')).toContainText('Evidence files: 2');

  await page.getByRole('button', { name: /Closure Report/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\/.+\/report/);
  await expect(page.getByRole('heading', { name: /Closure Report/i })).toBeVisible();
  await expect(page.getByText('Report ready')).toBeVisible();
  await expect(page.getByText('Case status: Active.')).toBeVisible();
  const reportEvidenceList = page.locator('.executor-evidence-list').first();
  await expect(reportEvidenceList).toContainText('dropbox-proof-1.pdf');
  await expect(reportEvidenceList).toContainText('dropbox-proof-2.png');

  await page.evaluate(() => {
    (window as Window & { __printCalls?: number }).__printCalls = 0;
    window.print = () => {
      (window as Window & { __printCalls?: number }).__printCalls = ((window as Window & { __printCalls?: number }).__printCalls || 0) + 1;
    };
  });
  await page.getByRole('button', { name: /Print \/ Save as PDF/i }).click();
  await expect.poll(async () => page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls || 0)).toBe(1);

  await page.getByRole('button', { name: /Close Case/i }).click();
  await expect(page.locator('.inventory-feedback').filter({ hasText: 'Case closed and evidence retention scheduled.' }).first()).toBeVisible();
  await expect(page.locator('.report-readiness-copy').first()).toContainText('Case status: Closed.');

  await page.getByRole('button', { name: /Back to Workspace/i }).click();
  await expect(page.getByText(/This case is closed/i)).toBeVisible();
});

test('executor sees pending review and rejected review states, then uploads a replacement certificate', async ({ page, request }) => {
  const owner = createTestUser('review-owner');
  const executor = createTestUser('review-executor');

  await apiSignupVerifyLogin(request, owner);
  await apiSignupVerifyLogin(request, executor);

  await loginThroughUi(page, owner);

  await page.goto('/dashboard/inventory');
  await page.getByRole('button', { name: /Add Account/i }).click();
  await page.getByLabel('Platform').fill('Dropbox');
  await page.getByLabel('Category').fill('storage');
  await page.getByLabel('Username Hint').fill(owner.email);
  await page.getByLabel('Importance (1-5)').fill('4');
  await page.getByRole('button', { name: /^Add Account$/ }).last().click();
  await expect(page.locator('.inventory-item').filter({ hasText: 'Dropbox' })).toHaveCount(1);

  await page.goto('/dashboard/trusted-contacts');
  await page.getByLabel('Name').fill('Executor User');
  await page.getByLabel('Email').fill(executor.email);
  await page.locator('#trusted-role').selectOption('executor');
  await page.getByLabel('Enable for account recovery').uncheck();
  await page.getByRole('button', { name: /Add Contact/i }).click();
  await expect(page.getByText('Trusted contact created.')).toBeVisible();

  const executorRow = page.locator('.inventory-item').filter({ hasText: executor.email }).first();
  await executorRow.getByRole('button', { name: /Invite/i }).click();
  const inviteFeedback = (await page.locator('.inventory-feedback').textContent()) || '';
  const inviteToken = extractTokenFromFeedback(inviteFeedback, 'Debug token:');

  await page.getByLabel('Invite Token').fill(inviteToken);
  await page.getByRole('button', { name: /^Accept$/ }).click();
  await expect(executorRow).toContainText('active');

  await page.getByRole('button', { name: /^Sign Out$/ }).click({ force: true });
  await expect(page).toHaveURL(/\/login/);
  await loginThroughUi(page, executor);

  await page.goto('/executor');
  const caseCard = page.locator('.executor-case-card').filter({ hasText: owner.email }).first();
  await expect(caseCard).toContainText('Activation pending');

  await page.getByLabel('Death Certificate PDF').setInputFiles({
    name: 'death-certificate-with-metadata.pdf',
    mimeType: 'application/pdf',
    buffer: REVIEW_PENDING_CERTIFICATE,
  });
  await page.getByRole('button', { name: /Upload and Activate/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\//);
  const reviewPanel = page.locator('.inventory-panel.executor-section').first();
  await expect(page.locator('.executor-task-readonly')).toContainText('Pending review');
  await expect(reviewPanel).toContainText(/manual review/i);
  await expect(reviewPanel).toContainText(/death certificate metadata detected/i);

  const caseId = new URL(page.url()).pathname.split('/').at(-1);
  expect(caseId).toBeTruthy();

  const rejectResponse = await request.post(`${playwrightApiBaseUrl}/api/v1/internal/case-reviews/${caseId}/reject`, {
    headers: {
      'X-Internal-Api-Key': playwrightInternalApiKey,
    },
    data: {
      reason: 'metadata_mismatch',
      note: 'Upload a replacement certificate without embedded editor metadata.',
    },
  });
  expect(rejectResponse.ok()).toBeTruthy();

  await page.goto('/executor');
  const rejectedCard = page.locator('.executor-case-card').filter({ hasText: owner.email }).first();
  await expect(rejectedCard).toContainText('Rejected review');
  await expect(page.getByText('metadata mismatch')).toBeVisible();
  await expect(page.getByLabel('Replacement Certificate PDF')).toBeVisible();

  await page.getByLabel('Replacement Certificate PDF').setInputFiles({
    name: 'replacement-certificate.pdf',
    mimeType: 'application/pdf',
    buffer: CLEAN_CERTIFICATE,
  });
  await page.getByRole('button', { name: /Upload Replacement Certificate/i }).click();
  await expect(page).toHaveURL(/\/executor\/cases\//);
  await expect(page.locator('.status-badge.live')).toContainText('Active case');
  await expect(page.locator('.executor-list-item').filter({ hasText: 'Dropbox' })).toHaveCount(1);
});
