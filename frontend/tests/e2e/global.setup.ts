import { request as playwrightRequest } from '@playwright/test';

import { ensurePolicies, waitForApi } from './helpers';

export default async function globalSetup(): Promise<void> {
  const apiRequest = await playwrightRequest.newContext();
  await waitForApi(apiRequest);
  await ensurePolicies(apiRequest);
  await apiRequest.dispose();
}

