'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient } from '../lib/api-client';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export default function Recovery() {
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMode, setRecoveryMode] = useState<'primary_email' | 'backup_email' | 'trusted_contact'>('primary_email');
  const [trustedContactEmail, setTrustedContactEmail] = useState('');
  const [approvalToken, setApprovalToken] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');

  const [debugResetToken, setDebugResetToken] = useState<string | null>(null);
  const [debugRecoveryToken, setDebugRecoveryToken] = useState<string | null>(null);
  const [debugApprovalToken, setDebugApprovalToken] = useState<string | null>(null);

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const handlePasswordResetRequest = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('password-reset-request');
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.passwordResetRequest({ body: { email: email.trim() } });
      setFeedback(response.message);
      if (response.reset_token) {
        setDebugResetToken(response.reset_token);
        setResetToken(response.reset_token);
      }
    } catch (requestError) {
      setError(errorMessage(requestError, 'Password reset request failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handlePasswordResetConfirm = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('password-reset-confirm');
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.passwordResetConfirm({
        body: {
          token: resetToken.trim(),
          new_password: newPassword,
        },
      });
      setFeedback(response.message);
    } catch (confirmError) {
      setError(errorMessage(confirmError, 'Password reset confirmation failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleRecoveryRequest = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('recovery-request');
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.recoveryRequest({
        body: {
          email: recoveryEmail.trim(),
          mode: recoveryMode,
          trusted_contact_email: recoveryMode === 'trusted_contact' ? trustedContactEmail.trim() || null : null,
        },
      });
      setFeedback(response.message);
      if (response.recovery_token) {
        setDebugRecoveryToken(response.recovery_token);
        setRecoveryToken(response.recovery_token);
      }
      if (response.approval_token) {
        setDebugApprovalToken(response.approval_token);
        setApprovalToken(response.approval_token);
      }
    } catch (requestError) {
      setError(errorMessage(requestError, 'Account recovery request failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleRecoveryAssist = async () => {
    setLoadingAction('recovery-assist');
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.recoveryAssist({
        body: { approval_token: approvalToken.trim() },
      });
      setFeedback(response.message);
    } catch (assistError) {
      setError(errorMessage(assistError, 'Recovery assist approval failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleRecoveryConfirm = async () => {
    setLoadingAction('recovery-confirm');
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.recoveryConfirm({
        body: {
          recovery_token: recoveryToken.trim(),
          new_password: newPassword,
        },
      });
      setFeedback(response.message);
    } catch (confirmError) {
      setError(errorMessage(confirmError, 'Recovery completion failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in" style={{ maxWidth: '680px' }}>
        <div className="auth-header">
          <div className="icon-wrapper primary">
            <LifeBuoy size={28} />
          </div>
          <h2>Account Recovery</h2>
          <p>Reset password or run assisted recovery with trusted contacts.</p>
        </div>

        {error && <p className="input-error-msg">{error}</p>}
        {feedback && <p className="inventory-feedback">{feedback}</p>}

        <section className="inventory-panel glass-panel">
          <h3 className="section-title">Password Reset</h3>
          <form className="auth-form" onSubmit={handlePasswordResetRequest}>
            <Input label="Account Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Button type="submit" isLoading={loadingAction === 'password-reset-request'}>
              Request Reset Token
            </Button>
          </form>

          {debugResetToken && (
            <p className="input-helper-msg" style={{ marginTop: '0.75rem' }}>
              Debug reset token: <code>{debugResetToken}</code>
            </p>
          )}

          <form className="auth-form" onSubmit={handlePasswordResetConfirm} style={{ marginTop: '1rem' }}>
            <Input label="Reset Token" value={resetToken} onChange={(event) => setResetToken(event.target.value)} required />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <Button type="submit" variant="secondary" isLoading={loadingAction === 'password-reset-confirm'}>
              Complete Password Reset
            </Button>
          </form>
        </section>

        <section className="inventory-panel glass-panel">
          <h3 className="section-title">Assisted Account Recovery</h3>
          <form className="auth-form" onSubmit={handleRecoveryRequest}>
            <Input
              label="Account Email"
              type="email"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              required
            />

            <label className="input-label" htmlFor="recovery-mode">
              Recovery Mode <span className="input-required">*</span>
            </label>
            <select
              id="recovery-mode"
              className="input-field"
              value={recoveryMode}
              onChange={(event) => setRecoveryMode(event.target.value as 'primary_email' | 'backup_email' | 'trusted_contact')}
            >
              <option value="primary_email">Primary Email</option>
              <option value="backup_email">Backup Email</option>
              <option value="trusted_contact">Trusted Contact</option>
            </select>

            {recoveryMode === 'trusted_contact' && (
              <Input
                label="Trusted Contact Email"
                type="email"
                value={trustedContactEmail}
                onChange={(event) => setTrustedContactEmail(event.target.value)}
                required
              />
            )}

            <Button type="submit" isLoading={loadingAction === 'recovery-request'}>
              Request Recovery
            </Button>
          </form>

          {debugRecoveryToken && (
            <p className="input-helper-msg" style={{ marginTop: '0.75rem' }}>
              Debug recovery token: <code>{debugRecoveryToken}</code>
            </p>
          )}
          {debugApprovalToken && (
            <p className="input-helper-msg" style={{ marginTop: '0.25rem' }}>
              Debug approval token: <code>{debugApprovalToken}</code>
            </p>
          )}

          <div className="auth-form" style={{ marginTop: '1rem' }}>
            <Input label="Approval Token" value={approvalToken} onChange={(event) => setApprovalToken(event.target.value)} />
            <Button type="button" variant="secondary" onClick={handleRecoveryAssist} isLoading={loadingAction === 'recovery-assist'}>
              Approve Recovery (Trusted Contact)
            </Button>
          </div>

          <div className="auth-form" style={{ marginTop: '1rem' }}>
            <Input label="Recovery Token" value={recoveryToken} onChange={(event) => setRecoveryToken(event.target.value)} />
            <Button type="button" variant="secondary" onClick={handleRecoveryConfirm} isLoading={loadingAction === 'recovery-confirm'}>
              Complete Recovery
            </Button>
          </div>
        </section>

        <div className="auth-footer">
          <p>
            Back to <Link href="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

