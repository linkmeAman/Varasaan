import Link from 'next/link';
import { Shield, ArrowRight, Lock, FileCheck, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge animate-fade-in">
            <Shield size={16} /> Beta Access
          </div>

          <h1 className="hero-title animate-fade-in" style={{ animationDelay: '100ms' }}>
            Secure Your <span className="text-gradient">Digital Legacy</span> for Those Who Matter Most
          </h1>

          <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '200ms' }}>
            We help families close, recover, and preserve digital life legally, fast, and with proof. Build your
            encrypted inventory today, so they're never locked out tomorrow.
          </p>

          <div className="hero-actions animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Link href="/dashboard" className="hero-cta hero-btn">
              Start Planning Free <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="bg-glow bg-glow-1"></div>
        <div className="bg-glow bg-glow-2"></div>
      </section>

      <section className="features-section" id="features">
        <div className="features-grid">
          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper">
              <Lock size={28} />
            </div>
            <h3>We Never Touch Credentials</h3>
            <p>
              We guide families to submit official, verified requests directly to platforms. Your actual passwords stay
              yours.
            </p>
          </div>

          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper">
              <FileCheck size={28} />
            </div>
            <h3>Legal Closure Packets</h3>
            <p>Instantly generate pre-filled submission forms customized for 50+ major Indian services and custodians.</p>
          </div>

          <div className="feature-card glass-panel">
            <div className="feature-icon-wrapper">
              <Users size={28} />
            </div>
            <h3>Executor Collaboration</h3>
            <p>Invite trusted family to a shared dashboard to split tasks and manage the after-loss process with clarity.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
