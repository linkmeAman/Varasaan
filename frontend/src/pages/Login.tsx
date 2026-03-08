import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock login simulating API request delay
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 1200);
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        
        <div className="auth-header">
           <div className="icon-wrapper primary"><ShieldAlert size={28} /></div>
           <h2>Welcome Back</h2>
           <p>Access your end-of-life digital inventory securely.</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          
          <div className="password-group">
            <Input 
              label="Secure Password" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <Link to="/recovery" className="forgot-link">Forgot password?</Link>
          </div>

          <Button type="submit" className="w-full mt-4" size="lg" isLoading={isLoading}>
            Sign In to Vault <ArrowRight size={18} />
          </Button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Start Planning Here</Link></p>
        </div>

      </div>
    </div>
  );
}
