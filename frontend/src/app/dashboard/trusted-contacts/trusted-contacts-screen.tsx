'use client';

import { useState } from 'react';
import { MailPlus, Shield, UserMinus, UserPlus, Users } from 'lucide-react';

import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { type TrustedContactResponse } from '../../../lib/api-client';
import { useTrustedContactsWorkspace } from '../../../lib/use-trusted-contacts-workspace';

export function TrustedContactsScreen() {
  const {
    contacts,
    inviteTokenInput,
    draft,
    feedback,
    error,
    loadingAction,
    setInviteTokenInput,
    setDraft,
    createContact,
    inviteContact,
    acceptInvite,
    revokeContact,
  } = useTrustedContactsWorkspace();
  const [contactPendingRevoke, setContactPendingRevoke] = useState<TrustedContactResponse | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState('');

  const handleCloseRevoke = () => {
    setContactPendingRevoke(null);
    setRevokeConfirmation('');
  };

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Trusted Contacts</p>
          <h2 className="dash-title">Trusted Contacts</h2>
          <p className="dash-subtitle">Create contacts, send invites, and manage access status.</p>
        </div>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <Dialog
        open={Boolean(contactPendingRevoke)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseRevoke();
          }
        }}
        title="Revoke trusted contact"
        description={
          contactPendingRevoke
            ? `Type ${contactPendingRevoke.name} to confirm that you want to revoke this trusted contact.`
            : undefined
        }
      >
        <div className="inventory-form">
          <Input label="Type contact name" value={revokeConfirmation} onChange={(event) => setRevokeConfirmation(event.target.value)} />
          <div className="inventory-actions-row">
            <Button
              type="button"
              variant="destructive"
              disabled={!contactPendingRevoke || revokeConfirmation !== contactPendingRevoke.name}
              isLoading={contactPendingRevoke ? loadingAction === `revoke-${contactPendingRevoke.id}` : false}
              onClick={async () => {
                if (!contactPendingRevoke) {
                  return;
                }

                const revoked = await revokeContact(contactPendingRevoke.id);
                if (revoked) {
                  handleCloseRevoke();
                }
              }}
            >
              <UserMinus size={16} /> Revoke Contact
            </Button>
            <Button type="button" variant="ghost" onClick={handleCloseRevoke}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Add Trusted Contact</h3>
        <div className="inventory-form">
          <div className="inventory-form-grid">
            <Input label="Name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            <Input
              label="Email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            />
            <label className="input-label" htmlFor="trusted-role">
              Role <span className="input-required">*</span>
            </label>
            <select
              id="trusted-role"
              className="input-field"
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  role: event.target.value as TrustedContactResponse['role'],
                }))
              }
            >
              <option value="executor">Executor</option>
              <option value="viewer">Viewer</option>
              <option value="packet_access">Packet Access</option>
              <option value="recovery_assist">Recovery Assist</option>
            </select>
          </div>

          <label className="heartbeat-toggle">
            <input
              type="checkbox"
              checked={draft.recoveryEnabled}
              onChange={(event) => setDraft((current) => ({ ...current, recoveryEnabled: event.target.checked }))}
            />
            <span>Enable for account recovery</span>
          </label>

          <Button type="button" onClick={() => void createContact()} isLoading={loadingAction === 'create'}>
            <UserPlus size={16} /> Add Contact
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Accept Invite Token</h3>
        <div className="inventory-actions-row">
          <Input label="Invite Token" value={inviteTokenInput} onChange={(event) => setInviteTokenInput(event.target.value)} />
          <Button type="button" variant="secondary" onClick={() => void acceptInvite()} isLoading={loadingAction === 'accept'}>
            <Shield size={16} /> Accept
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Current Contacts</h3>
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
                    onClick={() => void inviteContact(contact.id)}
                    isLoading={loadingAction === `invite-${contact.id}`}
                  >
                    <MailPlus size={14} /> Invite
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setContactPendingRevoke(contact);
                      setRevokeConfirmation('');
                    }}
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
