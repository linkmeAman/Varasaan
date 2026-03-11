import type { TokenPair } from './api-client';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'access_token_expires_at';
const REFRESH_TOKEN_EXPIRES_AT_KEY = 'refresh_token_expires_at';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasSessionTokens(): boolean {
  return Boolean(getAccessToken() && getRefreshToken());
}

export function storeTokenPair(tokenPair: TokenPair): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokenPair.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokenPair.refresh_token);
  window.localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, tokenPair.access_token_expires_at);
  window.localStorage.setItem(REFRESH_TOKEN_EXPIRES_AT_KEY, tokenPair.refresh_token_expires_at);
}

export function clearTokenPair(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
}
