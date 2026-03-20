'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CreditCard,
  FileArchive,
  FileHeart,
  Files,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth-context';

type DashboardShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/inventory', label: 'Inventory', icon: FolderOpen },
  { href: '/dashboard/trusted-contacts', label: 'Trusted Contacts', icon: Users },
  { href: '/dashboard/documents', label: 'Documents', icon: FileArchive },
  { href: '/dashboard/heartbeat', label: 'Heartbeat', icon: FileHeart },
  { href: '/dashboard/packets', label: 'Packets', icon: Files },
  { href: '/dashboard/exports', label: 'Exports', icon: FileArchive },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatSegment(segment: string): string {
  if (segment === 'trusted-contacts') {
    return 'Trusted Contacts';
  }
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, error, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [isLoading, pathname, router, user]);

  const breadcrumbs = (pathname || '/dashboard').split('/').filter(Boolean);
  const pageTitle = breadcrumbs.length > 1 ? formatSegment(breadcrumbs[breadcrumbs.length - 1] || 'dashboard') : 'Overview';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="dashboard-shell-root">
        <div className="dashboard-shell-loading">Loading your dashboard workspace...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-shell-root">
        <div className="dashboard-shell-loading">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell-root">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar glass-panel">
          <div className="dashboard-sidebar-brand">
            <ShieldCheck size={22} />
            <div>
              <p className="dashboard-sidebar-title">Varasaan</p>
              <p className="dashboard-sidebar-subtitle">Protected workspace</p>
            </div>
          </div>

          <div className="dashboard-sidebar-user">
            <p className="dashboard-sidebar-user-label">Signed in as</p>
            <p className="dashboard-sidebar-user-value">{user.email}</p>
          </div>

          <nav className="dashboard-sidebar-nav" aria-label="Dashboard navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`dashboard-sidebar-link ${isActive(pathname || '', item.href) ? 'is-active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Button type="button" variant="secondary" className="dashboard-sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} /> Sign Out
          </Button>
        </aside>

        <div className="dashboard-shell-main">
          <header className="dashboard-shell-header">
            <div className="dashboard-shell-header-copy">
              <nav className="dashboard-breadcrumbs" aria-label="Breadcrumb">
                <Link href="/dashboard">Dashboard</Link>
                {breadcrumbs.slice(1).map((segment, index) => (
                  <span key={`${segment}-${index}`}>{formatSegment(segment)}</span>
                ))}
              </nav>
              <h1 className="dashboard-shell-heading">{pageTitle}</h1>
            </div>
          </header>

          {error && <p className="input-error-msg dashboard-shell-alert">{error}</p>}

          <div className="dashboard-shell-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
