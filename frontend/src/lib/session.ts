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
