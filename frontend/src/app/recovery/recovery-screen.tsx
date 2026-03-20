'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { apiClient } from '../../lib/api-client';

const passwordResetRequestSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters.'),
});

const recoveryRequestSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    mode: z.enum(['primary_email', 'backup_email', 'trusted_contact']),
    trustedContactEmail: z.string().email('Enter a valid trusted contact email.').optional().or(z.literal('')),
  })
  .superRefine((values, context) => {
    if (values.mode === 'trusted_contact' && !values.trustedContactEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trustedContactEmail'],
        message: 'Trusted contact email is required for trusted-contact recovery.',
      });
    }
  });

const approvalSchema = z.object({
  approvalToken: z.string().min(1, 'Approval token is required.'),
});

const recoveryConfirmSchema = z.object({
  recoveryToken: z.string().min(1, 'Recovery token is required.'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters.'),
});

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function RecoveryScreen() {
  const resetRequestForm = useForm<z.infer<typeof passwordResetRequestSchema>>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });
  const resetConfirmForm = useForm<z.infer<typeof passwordResetConfirmSchema>>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { token: '', newPassword: '' },
  });
  const recoveryRequestForm = useForm<z.infer<typeof recoveryRequestSchema>>({
    resolver: zodResolver(recoveryRequestSchema),
    defaultValues: {
      email: '',
      mode: 'primary_email',
      trustedContactEmail: '',
    },
  });
  const approvalForm = useForm<z.infer<typeof approvalSchema>>({
    resolver: zodResolver(approvalSchema),
    defaultValues: { approvalToken: '' },
  });
  const recoveryConfirmForm = useForm<z.infer<typeof recoveryConfirmSchema>>({
    resolver: zodResolver(recoveryConfirmSchema),
    defaultValues: { recoveryToken: '', newPassword: '' },
  });

  const resetPassword = useWatch({ control: resetConfirmForm.control, name: 'newPassword' }) || '';
  const recoveryPassword = useWatch({ control: recoveryConfirmForm.control, name: 'newPassword' }) || '';
  const recoveryMode = useWatch({ control: recoveryRequestForm.control, name: 'mode' }) || 'primary_email';

  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [debugResetToken, setDebugResetToken] = useState<string | null>(null);
  const [debugRecoveryToken, setDebugRecoveryToken] = useState<string | null>(null);
  const [debugApprovalToken, setDebugApprovalToken] = useState<string | null>(null);

  const onPasswordResetRequest = resetRequestForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');
    try {
      const response = await apiClient.passwordResetRequest({ body: { email: values.email.trim() } });
      setFeedback(response.message);
      setDebugResetToken(response.reset_token ?? null);
      if (response.reset_token) {
        resetConfirmForm.setValue('token', response.reset_token);
      }
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Password reset request failed.'));
    }
  });

  const onPasswordResetConfirm = resetConfirmForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');
    try {
      const response = await apiClient.passwordResetConfirm({
        body: {
          token: values.token.trim(),
          new_password: values.newPassword,
        },
      });
      setFeedback(response.message);
    } catch (confirmError) {
      setFormError(errorMessage(confirmError, 'Password reset confirmation failed.'));
    }
  });

  const onRecoveryRequest = recoveryRequestForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');
    try {
      const response = await apiClient.recoveryRequest({
        body: {
          email: values.email.trim(),
          mode: values.mode,
          trusted_contact_email: values.mode === 'trusted_contact' ? values.trustedContactEmail?.trim() || null : null,
        },
      });
      setFeedback(response.message);
      setDebugRecoveryToken(response.recovery_token ?? null);
      setDebugApprovalToken(response.approval_token ?? null);
      if (response.recovery_token) {
        recoveryConfirmForm.setValue('recoveryToken', response.recovery_token);
      }
      if (response.approval_token) {
        approvalForm.setValue('approvalToken', response.approval_token);
      }
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Account recovery request failed.'));
    }
  });

  const onRecoveryAssist = approvalForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');
    try {
      const response = await apiClient.recoveryAssist({
        body: { approval_token: values.approvalToken.trim() },
      });
      setFeedback(response.message);
    } catch (assistError) {
      setFormError(errorMessage(assistError, 'Recovery assist approval failed.'));
    }
  });

  const onRecoveryConfirm = recoveryConfirmForm.handleSubmit(async (values) => {
    setFeedback('');
    setFormError('');
    try {
      const response = await apiClient.recoveryConfirm({
        body: {
          recovery_token: values.recoveryToken.trim(),
          new_password: values.newPassword,
        },
      });
      setFeedback(response.message);
    } catch (confirmError) {
      setFormError(errorMessage(confirmError, 'Recovery completion failed.'));
    }
  });

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

        {formError && <p className="input-error-msg">{formError}</p>}
        {feedback && <p className="inventory-feedback">{feedback}</p>}

        <section className="inventory-panel glass-panel">
          <h3 className="section-title">Password Reset</h3>
          <form className="auth-form" onSubmit={onPasswordResetRequest}>
            <Input
              label="Account Email"
              type="email"
              error={resetRequestForm.formState.errors.email?.message}
              {...resetRequestForm.register('email')}
            />
            <Button type="submit" isLoading={resetRequestForm.formState.isSubmitting}>
              Request Reset Token
            </Button>
          </form>

          {debugResetToken && (
            <p className="input-helper-msg" style={{ marginTop: '0.75rem' }}>
              Debug reset token: <code>{debugResetToken}</code>
            </p>
          )}

          <form className="auth-form" onSubmit={onPasswordResetConfirm} style={{ marginTop: '1rem' }}>
            <Input label="Reset Token" error={resetConfirmForm.formState.errors.token?.message} {...resetConfirmForm.register('token')} />
            <Input
              label="New Password"
              type="password"
              error={resetConfirmForm.formState.errors.newPassword?.message}
              {...resetConfirmForm.register('newPassword')}
            />
            <PasswordStrength password={resetPassword} />
            <Button type="submit" variant="secondary" isLoading={resetConfirmForm.formState.isSubmitting}>
              Complete Password Reset
            </Button>
          </form>
        </section>

        <section className="inventory-panel glass-panel">
          <h3 className="section-title">Assisted Account Recovery</h3>
          <form className="auth-form" onSubmit={onRecoveryRequest}>
            <Input
              label="Account Email"
              type="email"
              error={recoveryRequestForm.formState.errors.email?.message}
              {...recoveryRequestForm.register('email')}
            />

            <label className="input-label" htmlFor="recovery-mode">
              Recovery Mode <span className="input-required">*</span>
            </label>
            <select id="recovery-mode" className="input-field" {...recoveryRequestForm.register('mode')}>
              <option value="primary_email">Primary Email</option>
              <option value="backup_email">Backup Email</option>
              <option value="trusted_contact">Trusted Contact</option>
            </select>

            {recoveryMode === 'trusted_contact' && (
              <Input
                label="Trusted Contact Email"
                type="email"
                error={recoveryRequestForm.formState.errors.trustedContactEmail?.message}
                {...recoveryRequestForm.register('trustedContactEmail')}
              />
            )}

            <Button type="submit" isLoading={recoveryRequestForm.formState.isSubmitting}>
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

          <form className="auth-form" onSubmit={onRecoveryAssist} style={{ marginTop: '1rem' }}>
            <Input
              label="Approval Token"
              error={approvalForm.formState.errors.approvalToken?.message}
              {...approvalForm.register('approvalToken')}
            />
            <Button type="submit" variant="secondary" isLoading={approvalForm.formState.isSubmitting}>
              Approve Recovery (Trusted Contact)
            </Button>
          </form>

          <form className="auth-form" onSubmit={onRecoveryConfirm} style={{ marginTop: '1rem' }}>
            <Input
              label="Recovery Token"
              error={recoveryConfirmForm.formState.errors.recoveryToken?.message}
              {...recoveryConfirmForm.register('recoveryToken')}
            />
            <Input
              label="New Password"
              type="password"
              error={recoveryConfirmForm.formState.errors.newPassword?.message}
              {...recoveryConfirmForm.register('newPassword')}
            />
            <PasswordStrength password={recoveryPassword} />
            <Button type="submit" variant="secondary" isLoading={recoveryConfirmForm.formState.isSubmitting}>
              Complete Recovery
            </Button>
          </form>
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
