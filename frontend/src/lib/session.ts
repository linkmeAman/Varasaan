const DEFAULT_CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || 'varasaan_csrf_token';

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
  return getCookieValue(DEFAULT_CSRF_COOKIE_NAME);
}
