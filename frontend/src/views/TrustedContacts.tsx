'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailPlus, Shield, UserPlus, Users } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient, type TrustedContactResponse } from '../lib/api-client';
import { useAuthGuard } from '../lib/use-auth-guard';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

type ContactFormState = {
  name: string;
  email: string;
  role: 'viewer' | 'packet_access' | 'recovery_assist';
  recoveryEnabled: boolean;
};

const INITIAL_CONTACT_FORM: ContactFormState = {
  name: '',
  email: '',
  role: 'viewer',
  recoveryEnabled: false,
};

export default function TrustedContacts() {
  const { isLoading: authLoading, user } = useAuthGuard();
  const [contacts, setContacts] = useState<TrustedContactResponse[]>([]);
  const [form, setForm] = useState<ContactFormState>(INITIAL_CONTACT_FORM);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const loadContacts = async () => {
    const listed = await apiClient.listTrustedContacts();
    setContacts(listed);
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;

    const run = async () => {
      try {
        const listed = await apiClient.listTrustedContacts();
        if (mounted) {
          setContacts(listed);
        }
      } catch {
        if (mounted) {
          setError('Unable to load trusted contacts.');
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('create');
    setError('');
    setFeedback('');

    try {
      const created = await apiClient.createTrustedContact({
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          recovery_enabled: form.recoveryEnabled,
        },
      });
      setContacts((current) => [created, ...current]);
      setForm(INITIAL_CONTACT_FORM);
      setFeedback('Trusted contact created.');
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to create trusted contact.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleInvite = async (contactId: string) => {
    setLoadingAction(`invite-${contactId}`);
    setError('');
    setFeedback('');

    try {
      const response = await apiClient.inviteTrustedContact({
        trustedContactId: contactId,
        body: {
          force_reissue: true,
        },
      });
      const tokenMessage = response.invite_token ? ` Debug token: ${response.invite_token}` : '';
      setFeedback(`${response.message}${tokenMessage}`);
    } catch (inviteError) {
      setError(errorMessage(inviteError, 'Unable to send invite.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleRevoke = async (contactId: string) => {
    setLoadingAction(`revoke-${contactId}`);
    setError('');
    setFeedback('');

    try {
      await apiClient.revokeTrustedContact({ trustedContactId: contactId });
      await loadContacts();
      setFeedback('Trusted contact revoked.');
    } catch (revokeError) {
      setError(errorMessage(revokeError, 'Unable to revoke trusted contact.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleAcceptInvite = async () => {
    setLoadingAction('accept');
    setError('');
    setFeedback('');

    try {
      const response = await apiClient.acceptTrustedContactInvite({ token: inviteTokenInput.trim() });
      await loadContacts();
      setFeedback(response.message);
      setInviteTokenInput('');
    } catch (acceptError) {
      setError(errorMessage(acceptError, 'Unable to accept invite.'));
    } finally {
      setLoadingAction('');
    }
  };

  if (authLoading) {
    return (
      <div className="inventory-manager animate-fade-in">
        <p className="inventory-empty">Loading trusted contacts...</p>
      </div>
    );
  }

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Trusted Contacts</h1>
        <p className="dash-subtitle">Create contacts, send invites, and manage access status.</p>
      </div>

      {feedback && <p className="inventory-feedback">{feedback}</p>}
      {error && <p className="input-error-msg">{error}</p>}

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Add Trusted Contact</h2>
        <form className="inventory-form" onSubmit={handleCreate}>
          <div className="inventory-form-grid">
            <Input label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <label className="input-label" htmlFor="trusted-role">
              Role <span className="input-required">*</span>
            </label>
            <select
              id="trusted-role"
              className="input-field"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as 'viewer' | 'packet_access' | 'recovery_assist' }))
              }
            >
              <option value="viewer">Viewer</option>
              <option value="packet_access">Packet Access</option>
              <option value="recovery_assist">Recovery Assist</option>
            </select>
          </div>

          <label className="input-label" htmlFor="recovery-enabled">
            <input
              id="recovery-enabled"
              type="checkbox"
              checked={form.recoveryEnabled}
              onChange={(event) => setForm((current) => ({ ...current, recoveryEnabled: event.target.checked }))}
              style={{ marginRight: '0.5rem' }}
            />
            Enable for account recovery
          </label>

          <Button type="submit" isLoading={loadingAction === 'create'}>
            <UserPlus size={16} /> Add Contact
          </Button>
        </form>
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Accept Invite Token</h2>
        <div className="inventory-actions-row">
          <Input
            label="Invite Token"
            value={inviteTokenInput}
            onChange={(event) => setInviteTokenInput(event.target.value)}
            placeholder="Paste invite token"
          />
          <Button type="button" variant="secondary" onClick={handleAcceptInvite} isLoading={loadingAction === 'accept'}>
            <Shield size={16} /> Accept
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Current Contacts</h2>
        {contacts.length === 0 ? (
          <p className="inventory-empty">No trusted contacts yet.</p>
        ) : (
          <div className="inventory-list">
            {contacts.map((contact) => (
              <div key={contact.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">{contact.role}</div>
                  <h4>{contact.name}</h4>
                  <p className="item-secondary">{contact.email}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${contact.status === 'active' ? 'success' : 'warning'}`}>{contact.status}</span>
                </div>
                <div className="inventory-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleInvite(contact.id)}
                    isLoading={loadingAction === `invite-${contact.id}`}
                  >
                    <MailPlus size={14} /> Invite
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleRevoke(contact.id)}
                    isLoading={loadingAction === `revoke-${contact.id}`}
                  >
                    <Users size={14} /> Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
