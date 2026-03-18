'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiClient, type UserSessionResponse } from './api-client';

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserSessionResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const verifySession = async () => {
      setIsLoading(true);
      try {
        const current = await apiClient.currentUser();
        if (!mounted) {
          return;
        }
        setUser(current);
        setIsLoading(false);
      } catch {
        if (!mounted) {
          return;
        }
        setUser(null);
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
