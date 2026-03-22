'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldAlert } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api-client';
import { getCsrfTokenFromCookie, waitForCsrfTokenRefresh } from '../lib/session';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { response?: { data?: { error?: { message?: string } } } };
    const message = errorObj.response?.data?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const searchParams = useSearchParams();

  useEffect(() => {
    let mounted = true;
    const checkExistingSession = async () => {
      try {
        await apiClient.currentUser();
        if (!mounted) {
          return;
        }
        const next = searchParams.get('next') || '/dashboard';
        window.location.replace(next);
      } catch {
        // stay on login page
      }
    };

    void checkExistingSession();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setFeedback('');

    try {
      const previousCsrfToken = getCsrfTokenFromCookie();
      await apiClient.login({
        body: {
          email: email.trim(),
          password,
        },
      });
      await waitForCsrfTokenRefresh(previousCsrfToken);
      const next = searchParams.get('next') || '/dashboard';
      window.location.assign(next);
    } catch (error) {
      setFeedback(extractErrorMessage(error, 'Unable to login. Check your credentials and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="icon-wrapper primary">
            <ShieldAlert size={28} />
          </div>
          <h2>Welcome Back</h2>
          <p>Access your end-of-life digital inventory securely.</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <div className="password-group">
            <Input
              label="Secure Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Link href="/recovery" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          {feedback && <p className="input-error-msg">{feedback}</p>}

          <Button type="submit" className="w-full mt-4" size="lg" isLoading={isLoading}>
            Sign In to Vault <ArrowRight size={18} />
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            Don&apos;t have an account? <Link href="/register">Start Planning Here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
