import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { getCsrfTokenFromCookie } from './session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const CSRF_HEADER_NAME = process.env.NEXT_PUBLIC_CSRF_HEADER_NAME || 'X-CSRF-Token';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const NO_REFRESH_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/password-reset/request',
  '/api/v1/auth/password-reset/confirm',
  '/api/v1/auth/recovery/request',
  '/api/v1/auth/recovery/assist',
  '/api/v1/auth/recovery/confirm',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/csrf',
  '/api/v1/auth/logout',
  '/api/v1/auth/logout-all',
];

const NO_REDIRECT_AUTH_PATHS = [...NO_REFRESH_AUTH_PATHS, '/api/v1/auth/me'];

let refreshRequestPromise: Promise<boolean> | null = null;
let csrfBootstrapPromise: Promise<string | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isMutatingMethod(method: string | undefined): boolean {
  const normalized = (method || '').toUpperCase();
  return normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH' || normalized === 'DELETE';
}

function matchesPath(url: string, paths: string[]): boolean {
  return paths.some((path) => url.includes(path));
}

function navigateToLogin() {
  if (!isBrowser()) {
    return;
  }

  if (window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfTokenFromCookie();
  if (existing) {
    return existing;
  }

  if (csrfBootstrapPromise) {
    return csrfBootstrapPromise;
  }

  csrfBootstrapPromise = axios
    .get<{ csrf_token: string }>(`${API_BASE_URL}/api/v1/auth/csrf`, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then((response) => response.data?.csrf_token || getCsrfTokenFromCookie())
    .catch(() => null)
    .finally(() => {
      csrfBootstrapPromise = null;
    });

  return csrfBootstrapPromise;
}

api.interceptors.request.use(async (config) => {
  config.withCredentials = true;

  if (isBrowser() && isMutatingMethod(config.method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      const headers = AxiosHeaders.from(config.headers ?? {});
      headers.set(CSRF_HEADER_NAME, csrfToken);
      config.headers = headers;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!isBrowser()) {
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    const originalRequest = (error?.config ?? {}) as RetryRequestConfig;
    const requestUrl = originalRequest.url ?? '';
    const skipRefresh = matchesPath(requestUrl, NO_REFRESH_AUTH_PATHS);
    const suppressRedirect = matchesPath(requestUrl, NO_REDIRECT_AUTH_PATHS);

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (requestUrl.includes('/api/v1/auth/refresh')) {
      return Promise.reject(error);
    }

    if (skipRefresh) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      if (!suppressRedirect) {
        navigateToLogin();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshRequestPromise) {
      refreshRequestPromise = api
        .post('/api/v1/auth/refresh', {})
        .then(() => true)
        .catch(() => false)
        .finally(() => {
          refreshRequestPromise = null;
        });
    }

    const refreshed = await refreshRequestPromise;
    if (!refreshed) {
      if (!suppressRedirect) {
        navigateToLogin();
      }
      return Promise.reject(error);
    }

    if (isMutatingMethod(originalRequest.method)) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        const headers = AxiosHeaders.from(originalRequest.headers ?? {});
        headers.set(CSRF_HEADER_NAME, csrfToken);
        originalRequest.headers = headers;
      }
    }

    return api.request(originalRequest);
  },
);

export default api;
