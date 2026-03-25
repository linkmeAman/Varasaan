import crypto from 'node:crypto';

import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

import { playwrightApiBaseUrl } from './env';

export const API_BASE_URL = playwrightApiBaseUrl;
const DEFAULT_PASSWORD = 'StrongPassw0rd!!123';

export type TestUser = {
  email: string;
  password: string;
};

export function createTestUser(prefix: string, password: string = DEFAULT_PASSWORD): TestUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}-${suffix}@example.com`,
    password,
  };
}

export async function waitForApi(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await request.get(`${API_BASE_URL}/healthz`);
      if (response.ok()) {
        return;
      }
    } catch {
      // retry until backend is up
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Backend did not become healthy at ${API_BASE_URL}`);
}

export async function ensurePolicies(request: APIRequestContext): Promise<void> {
  const listResponse = await request.get(`${API_BASE_URL}/api/v1/legal/policies`);
  expect(listResponse.ok()).toBeTruthy();

  const policies = (await listResponse.json()) as Array<{ policy_type: string; version: string }>;
  const requiredPolicies = [
    { policy_type: 'privacy', version: '2026.03', checksum: 'privacy-2026-03' },
    { policy_type: 'terms', version: '2026.03', checksum: 'terms-2026-03' },
  ];

  for (const policy of requiredPolicies) {
    const exists = policies.some(
      (candidate) => candidate.policy_type === policy.policy_type && candidate.version === policy.version,
    );
    if (exists) {
      continue;
    }

    const createResponse = await request.post(`${API_BASE_URL}/api/v1/legal/policies`, {
      data: {
        policy_type: policy.policy_type,
        version: policy.version,
        effective_from: '2026-03-01T00:00:00Z',
        checksum: policy.checksum,
        is_active: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
  }
}

export async function apiSignupVerifyLogin(request: APIRequestContext, user: TestUser) {
  await ensurePolicies(request);

  const signupResponse = await request.post(`${API_BASE_URL}/api/v1/auth/signup`, {
    data: {
      email: user.email,
      password: user.password,
      consents: [
        { policy_type: 'privacy', policy_version: '2026.03' },
        { policy_type: 'terms', policy_version: '2026.03' },
      ],
    },
  });
  expect(signupResponse.ok()).toBeTruthy();
  const signupBody = await signupResponse.json();
  expect(signupBody.verification_token).toBeTruthy();

  const verifyResponse = await request.post(`${API_BASE_URL}/api/v1/auth/verify-email`, {
    data: {
      token: signupBody.verification_token,
    },
  });
  expect(verifyResponse.ok()).toBeTruthy();

  const loginResponse = await request.post(`${API_BASE_URL}/api/v1/auth/login`, {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  return loginResponse.json();
}

export async function registerThroughUi(page: Page, user: TestUser): Promise<string> {
  await ensurePolicies(page.request);
  await page.goto('/register');

  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Full Name').fill('E2E User');
  await page.getByLabel('Phone').fill('9999999999');
  await page.getByLabel('Jurisdiction').fill('IN');
  await page.getByLabel('Password').fill(user.password);
  await page.getByLabel('Confirm Password').fill(user.password);
  await page.getByRole('button', { name: /Create Account/i }).click();

  await expect(page.getByText('Signup successful')).toBeVisible();
  const verificationToken = await extractDebugCode(page, 'Debug verification token:');

  await page.getByLabel('Verification Token').fill(verificationToken);
  await page.getByRole('button', { name: /Verify Email/i }).click();
  await expect(page).toHaveURL(/\/login/);

  return verificationToken;
}

export async function loginThroughUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Secure Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In to Vault/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function extractDebugCode(page: Page, label: string): Promise<string> {
  const locator = page.locator(`p:has-text("${label}") code`).first();
  await expect(locator).toBeVisible();
  return (await locator.textContent())!.trim();
}

export function extractTokenFromFeedback(text: string, prefix: string): string {
  const pattern = new RegExp(`${escapeRegExp(prefix)}\\s*([A-Za-z0-9_-]+)`);
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Unable to extract token using prefix: ${prefix}`);
  }
  return match[1];
}

export async function waitForPopup(context: BrowserContext, action: () => Promise<void>) {
  const popupPromise = context.waitForEvent('page');
  await action();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  return popup;
}

export function signWebhook(payload: unknown, secret: string): { raw: string; signature: string } {
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return { raw, signature };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


