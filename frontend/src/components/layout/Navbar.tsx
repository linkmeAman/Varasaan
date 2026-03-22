'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, ShieldCheck, X } from 'lucide-react';

import { useAuth } from '../../lib/auth-context';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHome = pathname === '/';
  const isDashboardRoute = pathname?.startsWith('/dashboard');
  const isExecutorRoute = pathname?.startsWith('/executor');
  const hasSession = Boolean(user);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isDashboardRoute || isExecutorRoute) {
    return null;
  }

  return (
    <nav className={`navbar ${scrolled ? 'nav-scrolled glass-panel' : 'nav-transparent'}`}>
      <div className="nav-container">
        <Link href="/" className="nav-brand">
          <div className="brand-logo-container">
            <ShieldCheck size={28} className="brand-icon" />
          </div>
          <span className="brand-text">Legacy Manager</span>
        </Link>

        <div className="nav-menu">
          {isHome ? (
            <>
              <a href="#features" className="nav-link">
                Features
              </a>
              <Link href="/register" className="nav-link">
                Register
              </Link>
              <Link href="/login" className="nav-link">
                Login
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard" className="nav-link">
                Overview
              </Link>
              <Link href="/dashboard/inventory" className="nav-link">
                Inventory
              </Link>
              <Link href="/dashboard/trusted-contacts" className="nav-link">
                Contacts
              </Link>
              <Link href="/dashboard/documents" className="nav-link">
                Documents
              </Link>
              <Link href="/dashboard/billing" className="nav-link">
                Billing
              </Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          {hasSession ? (
            <button type="button" className="nav-cta animate-fade-in" onClick={handleLogout}>
              Sign Out
            </button>
          ) : (
            <Link href="/login" className="nav-cta animate-fade-in">
              Get Started
            </Link>
          )}
        </div>

        <button type="button" className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  );
}
