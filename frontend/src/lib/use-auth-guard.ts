'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from './auth-context';

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? '/dashboard')}`);
    }
  }, [isLoading, pathname, router, user]);

  return { isLoading, user };
}
