import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Menu, X } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHome = location.pathname === '/';

  return (
    <nav className={`navbar ${scrolled ? 'nav-scrolled glass-panel' : 'nav-transparent'}`}>
      <div className="nav-container">
        
        <Link to="/" className="nav-brand">
          <div className="brand-logo-container">
            <ShieldCheck size={28} className="brand-icon" />
          </div>
          <span className="brand-text">Legacy Manager</span>
        </Link>

        {/* Desktop Menu */}
        <div className="nav-menu">
          {isHome ? (
            <>
              <a href="#features" className="nav-link">Features</a>
              <a href="#how-it-works" className="nav-link">How it Works</a>
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="nav-link">Overview</Link>
              <Link to="/dashboard/inventory" className="nav-link">Inventory</Link>
              <Link to="/executor" className="nav-link">Executor</Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          <Link to="/dashboard" className="btn-primary animate-fade-in">
             Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

      </div>
    </nav>
  );
}
