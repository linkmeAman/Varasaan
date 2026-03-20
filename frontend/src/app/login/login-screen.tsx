'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../lib/auth-context';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, error: authError, isLoading: authLoading } = useAuth();
  const [feedback, setFeedback] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!authLoading && user) {
      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    }
  }, [authLoading, router, searchParams, user]);

  const onSubmit = handleSubmit(async (values) => {
    setFeedback('');
    try {
      await login({
        email: values.email.trim(),
        password: values.password,
      });
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
    } catch {
      setFeedback('Unable to login. Check your credentials and try again.');
    }
  });

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="icon-wrapper primary">
            <ShieldAlert size={28} />
          </div>
          <h2>Welcome Back</h2>
          <p>Access your end-of-life digital inventory securely.</p>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <Input label="Email Address" type="email" placeholder="you@domain.com" error={errors.email?.message} {...register('email')} />

          <div className="password-group">
            <Input
              label="Secure Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Link href="/recovery" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          {(feedback || authError) && <p className="input-error-msg">{authError || feedback}</p>}

          <Button type="submit" className="w-full mt-4" size="lg" isLoading={isSubmitting}>
            Sign In to Vault <ArrowRight size={18} />
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            Don&apos;t have an account? <Link href="/register">Start Planning Here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

