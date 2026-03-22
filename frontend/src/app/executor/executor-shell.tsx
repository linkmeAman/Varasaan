'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BriefcaseBusiness, LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth-context';

type ExecutorShellProps = {
  children: ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ExecutorShell({ children }: ExecutorShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, error, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/executor')}`);
    }
  }, [isLoading, pathname, router, user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="executor-shell-root">
        <div className="dashboard-shell-loading">Loading executor workspace...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="executor-shell-root">
        <div className="dashboard-shell-loading">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="executor-shell-root">
      <div className="executor-shell-bar glass-panel">
        <div className="executor-shell-brand">
          <ShieldCheck size={22} />
          <div>
            <p className="dashboard-sidebar-title">Varasaan</p>
            <p className="dashboard-sidebar-subtitle">Executor workspace</p>
          </div>
        </div>

        <nav className="executor-shell-nav" aria-label="Executor navigation">
          <Link href="/executor" className={`dashboard-sidebar-link ${isActive(pathname || '', '/executor') ? 'is-active' : ''}`}>
            <BriefcaseBusiness size={16} />
            <span>Cases</span>
          </Link>
        </nav>

        <div className="executor-shell-account">
          <p className="dashboard-sidebar-user-label">Signed in as</p>
          <p className="dashboard-sidebar-user-value">{user.email}</p>
        </div>

        <Button type="button" variant="secondary" className="dashboard-sidebar-logout" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </Button>
      </div>

      {error ? <p className="input-error-msg executor-shell-alert">{error}</p> : null}

      <div className="executor-shell-content">{children}</div>
    </div>
  );
}
