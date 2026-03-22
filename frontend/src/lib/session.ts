import { CSRF_COOKIE_NAME } from './auth-cookies';

function canUseDocument(): boolean {
  return typeof document !== 'undefined';
}

export function getCookieValue(name: string): string | null {
  if (!canUseDocument()) {
    return null;
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(?:^|; )${escaped}=([^;]*)`);
  const matched = document.cookie.match(matcher);
  if (!matched) {
    return null;
  }
  return decodeURIComponent(matched[1]);
}

export function getCsrfTokenFromCookie(): string | null {
  return getCookieValue(CSRF_COOKIE_NAME);
}

export async function waitForCsrfTokenRefresh(previousToken: string | null, timeoutMs: number = 1_500): Promise<void> {
  if (!canUseDocument()) {
    return;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentToken = getCsrfTokenFromCookie();
    if (currentToken && currentToken !== previousToken) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
}
