'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { apiClient, type LegalPolicyResponse } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    jurisdictionCode: z.string().min(2, 'Jurisdiction is required.'),
    password: z.string().min(12, 'Password must be at least 12 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

const verifySchema = z.object({
  token: z.string().min(1, 'Verification token is required.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;
type VerifyFormValues = z.infer<typeof verifySchema>;

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return fallback;
}

function pickPolicyVersion(policies: LegalPolicyResponse[], policyType: 'privacy' | 'terms'): string | null {
  const candidates = policies.filter((policy) => policy.policy_type === policyType);
  if (!candidates.length) {
    return null;
  }

  const byDate = [...candidates].sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  return byDate[0]?.version ?? null;
}

export function RegisterScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [policies, setPolicies] = useState<LegalPolicyResponse[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [debugVerificationToken, setDebugVerificationToken] = useState<string | null>(null);

  const privacyVersion = useMemo(() => pickPolicyVersion(policies, 'privacy'), [policies]);
  const termsVersion = useMemo(() => pickPolicyVersion(policies, 'terms'), [policies]);

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
      jurisdictionCode: 'IN',
      password: '',
      confirmPassword: '',
    },
  });

  const verifyForm = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      token: searchParams.get('verify_token') || '',
    },
  });

  const watchedPassword = useWatch({ control: registerForm.control, name: 'password' }) || '';
  const canSubmit = Boolean(privacyVersion && termsVersion && !isLoadingPolicies);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    let mounted = true;

    const loadPolicies = async () => {
      try {
        const fetchedPolicies = await apiClient.listPolicies();
        if (!mounted) {
          return;
        }
        setPolicies(fetchedPolicies);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setFormError(errorMessage(loadError, 'Unable to load policy versions. Please try again later.'));
      } finally {
        if (mounted) {
          setIsLoadingPolicies(false);
        }
      }
    };

    void loadPolicies();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const verifyToken = searchParams.get('verify_token') || '';
    verifyForm.setValue('token', verifyToken);
  }, [searchParams, verifyForm]);

  const onRegister = registerForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');

    if (!canSubmit) {
      setFormError('Policy versions are not ready yet.');
      return;
    }

    try {
      const response = await apiClient.signup({
        body: {
          email: values.email.trim(),
          password: values.password,
          full_name: values.fullName?.trim() || null,
          phone: values.phone?.trim() || null,
          jurisdiction_code: values.jurisdictionCode.trim().toUpperCase(),
          consents: [
            { policy_type: 'privacy', policy_version: privacyVersion! },
            { policy_type: 'terms', policy_version: termsVersion! },
          ],
        },
      });

      setFeedback(response.message);
      setDebugVerificationToken(response.verification_token ?? null);
      if (response.verification_token) {
        verifyForm.setValue('token', response.verification_token);
      }
    } catch (signupError) {
      setFormError(errorMessage(signupError, 'Signup failed. Please verify your details and try again.'));
    }
  });

  const onVerify = verifyForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');

    try {
      const response = await apiClient.verifyEmail({
        body: {
          token: values.token.trim(),
        },
      });
      setFeedback(response.message);
      router.push('/login');
    } catch (verifyError) {
      setFormError(errorMessage(verifyError, 'Email verification failed. Check the token and retry.'));
    }
  });

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="icon-wrapper primary">
            <UserPlus size={28} />
          </div>
          <h2>Create Your Account</h2>
          <p>Start building a secure digital legacy plan.</p>
        </div>

        <form onSubmit={onRegister} className="auth-form">
          <Input label="Email Address" type="email" error={registerForm.formState.errors.email?.message} {...registerForm.register('email')} />
          <Input label="Full Name" error={registerForm.formState.errors.fullName?.message} {...registerForm.register('fullName')} />
          <Input label="Phone" error={registerForm.formState.errors.phone?.message} {...registerForm.register('phone')} />
          <Input
            label="Jurisdiction"
            placeholder="IN"
            error={registerForm.formState.errors.jurisdictionCode?.message}
            {...registerForm.register('jurisdictionCode')}
          />
          <Input
            label="Password"
            type="password"
            helperText="Minimum 12 characters"
            error={registerForm.formState.errors.password?.message}
            {...registerForm.register('password')}
          />
          <PasswordStrength password={watchedPassword} />
          <Input
            label="Confirm Password"
            type="password"
            error={registerForm.formState.errors.confirmPassword?.message}
            {...registerForm.register('confirmPassword')}
          />

          <p className="input-helper-msg">
            Consent versions: privacy <strong>{privacyVersion ?? 'loading'}</strong>, terms <strong>{termsVersion ?? 'loading'}</strong>
          </p>

          {formError && <p className="input-error-msg">{formError}</p>}
          {feedback && <p className="inventory-feedback">{feedback}</p>}

          <Button type="submit" className="w-full mt-4" size="lg" isLoading={registerForm.formState.isSubmitting} disabled={!canSubmit}>
            Create Account <ArrowRight size={18} />
          </Button>
        </form>

        <div className="inventory-panel glass-panel">
          <h3 className="section-title">Verify Email</h3>
          <form className="auth-form" onSubmit={onVerify}>
            {debugVerificationToken && (
              <p className="input-helper-msg">
                Debug verification token: <code>{debugVerificationToken}</code>
              </p>
            )}
            <Input
              label="Verification Token"
              placeholder="Paste token from email"
              error={verifyForm.formState.errors.token?.message}
              {...verifyForm.register('token')}
            />
            <Button type="submit" variant="secondary" isLoading={verifyForm.formState.isSubmitting}>
              Verify Email
            </Button>
          </form>
        </div>

        <div className="auth-footer">
          <p>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
