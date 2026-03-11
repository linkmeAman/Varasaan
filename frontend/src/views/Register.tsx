'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, UserPlus } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient, type LegalPolicyResponse } from '../lib/api-client';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (candidate) {
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

  const byDate = [...candidates].sort((a, b) => {
    const left = new Date(a.effective_from).getTime();
    const right = new Date(b.effective_from).getTime();
    return right - left;
  });

  return byDate[0]?.version ?? null;
}

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [jurisdictionCode, setJurisdictionCode] = useState('IN');

  const [policies, setPolicies] = useState<LegalPolicyResponse[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);

  const [verificationTokenInput, setVerificationTokenInput] = useState(searchParams.get('verify_token') || '');
  const [debugVerificationToken, setDebugVerificationToken] = useState<string | null>(null);

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const privacyVersion = useMemo(() => pickPolicyVersion(policies, 'privacy'), [policies]);
  const termsVersion = useMemo(() => pickPolicyVersion(policies, 'terms'), [policies]);

  useEffect(() => {
    let mounted = true;

    const loadPolicies = async () => {
      try {
        const fetched = await apiClient.listPolicies();
        if (!mounted) {
          return;
        }
        setPolicies(fetched);
      } catch {
        if (!mounted) {
          return;
        }
        setError('Unable to load policy versions. Please try again later.');
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

  const canSubmit = Boolean(privacyVersion && termsVersion && !isLoadingPolicies);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    if (!canSubmit) {
      setError('Policy versions are not ready yet.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.signup({
        body: {
          email: email.trim(),
          password,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          jurisdiction_code: jurisdictionCode.trim().toUpperCase() || 'IN',
          consents: [
            { policy_type: 'privacy', policy_version: privacyVersion! },
            { policy_type: 'terms', policy_version: termsVersion! },
          ],
        },
      });

      setFeedback(response.message);
      if (response.verification_token) {
        setDebugVerificationToken(response.verification_token);
        setVerificationTokenInput(response.verification_token);
      }
    } catch (signupError) {
      setError(errorMessage(signupError, 'Signup failed. Please verify your details and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationTokenInput.trim()) {
      setError('Verification token is required.');
      return;
    }

    setIsVerifying(true);
    setError('');
    setFeedback('');

    try {
      const response = await apiClient.verifyEmail({
        body: {
          token: verificationTokenInput.trim(),
        },
      });
      setFeedback(response.message);
      router.push('/login');
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'Email verification failed. Check token and retry.'));
    } finally {
      setIsVerifying(false);
    }
  };

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

        <form onSubmit={handleRegister} className="auth-form">
          <Input label="Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input label="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Input
            label="Jurisdiction"
            placeholder="IN"
            value={jurisdictionCode}
            onChange={(event) => setJurisdictionCode(event.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText="Minimum 12 characters"
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          <p className="input-helper-msg">
            Consent versions: privacy <strong>{privacyVersion ?? 'loading'}</strong>, terms{' '}
            <strong>{termsVersion ?? 'loading'}</strong>
          </p>

          {error && <p className="input-error-msg">{error}</p>}
          {feedback && <p className="inventory-feedback">{feedback}</p>}

          <Button type="submit" className="w-full mt-4" size="lg" isLoading={isSubmitting} disabled={!canSubmit}>
            Create Account <ArrowRight size={18} />
          </Button>
        </form>

        <div className="inventory-panel glass-panel">
          <h3 className="section-title">Verify Email</h3>
          <div className="auth-form">
            {debugVerificationToken && (
              <p className="input-helper-msg">
                Debug verification token: <code>{debugVerificationToken}</code>
              </p>
            )}
            <Input
              label="Verification Token"
              value={verificationTokenInput}
              onChange={(event) => setVerificationTokenInput(event.target.value)}
              placeholder="Paste token from email"
            />
            <Button type="button" variant="secondary" onClick={handleVerify} isLoading={isVerifying}>
              Verify Email
            </Button>
          </div>
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
