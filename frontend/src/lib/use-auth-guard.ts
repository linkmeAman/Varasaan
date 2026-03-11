'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiClient, type UserSessionResponse } from './api-client';
import { clearTokenPair, hasSessionTokens } from './session';

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserSessionResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
      if (!hasSessionTokens()) {
        if (mounted) {
          setIsLoading(false);
          router.replace(`/login?next=${encodeURIComponent(pathname ?? '/dashboard')}`);
        }
        return;
      }

      try {
        const current = await apiClient.currentUser();
        if (!mounted) {
          return;
        }
        setUser(current);
        setIsLoading(false);
      } catch {
        clearTokenPair();
        if (!mounted) {
          return;
        }
        setIsLoading(false);
        router.replace(`/login?next=${encodeURIComponent(pathname ?? '/dashboard')}`);
      }
    };

    void verifySession();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  return { isLoading, user };
}
