import axios from 'axios';

import { clearTokenPair, getAccessToken, getRefreshToken, storeTokenPair } from './session';
import type { TokenPair } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetryRequestConfig = {
  _retry?: boolean;
  url?: string;
  headers?: Record<string, string>;
};

const AUTH_WHITELIST = [
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/refresh',
  '/api/v1/auth/password-reset/request',
  '/api/v1/auth/password-reset/confirm',
  '/api/v1/auth/recovery/request',
  '/api/v1/auth/recovery/assist',
  '/api/v1/auth/recovery/confirm',
  '/api/v1/auth/verify-email',
];

let refreshRequestPromise: Promise<string | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
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

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<TokenPair>(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    storeTokenPair(response.data);
    return response.data.access_token;
  } catch {
    clearTokenPair();
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (AUTH_WHITELIST.some((path) => requestUrl.includes(path))) {
      clearTokenPair();
      navigateToLogin();
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearTokenPair();
      navigateToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshRequestPromise) {
      refreshRequestPromise = refreshAccessToken().finally(() => {
        refreshRequestPromise = null;
      });
    }

    const refreshedAccessToken = await refreshRequestPromise;
    if (!refreshedAccessToken) {
      navigateToLogin();
      return Promise.reject(error);
    }

    originalRequest.headers = {
      ...(originalRequest.headers ?? {}),
      Authorization: `Bearer ${refreshedAccessToken}`,
    };

    return api.request(originalRequest);
  },
);

export default api;
