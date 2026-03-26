export const DEFAULT_PLAYWRIGHT_BASE_URL = 'http://localhost:3000';
export const DEFAULT_PLAYWRIGHT_API_BASE_URL = 'http://127.0.0.1:8000';
export const DEFAULT_PLAYWRIGHT_INTERNAL_API_KEY = 'dev-internal-api-key';

export const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_PLAYWRIGHT_BASE_URL;
export const playwrightApiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL || DEFAULT_PLAYWRIGHT_API_BASE_URL;
export const playwrightInternalApiKey =
  process.env.PLAYWRIGHT_INTERNAL_API_KEY || DEFAULT_PLAYWRIGHT_INTERNAL_API_KEY;
