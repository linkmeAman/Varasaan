'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHome = pathname === '/';

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
              <a href="#how-it-works" className="nav-link">
                How it Works
              </a>
              <Link href="/dashboard" className="nav-link">
                Dashboard
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
              <Link href="/executor" className="nav-link">
                Executor
              </Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          <Link href="/dashboard" className="nav-cta animate-fade-in">
            Get Started
          </Link>
        </div>

        <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  );
}
