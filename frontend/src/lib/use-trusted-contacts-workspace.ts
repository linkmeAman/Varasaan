'use client';

import { useEffect, useState } from 'react';

import { apiClient, type TrustedContactResponse } from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';

export type TrustedContactDraft = {
  name: string;
  email: string;
  role: 'viewer' | 'packet_access' | 'recovery_assist';
  recoveryEnabled: boolean;
};

const INITIAL_DRAFT: TrustedContactDraft = {
  name: '',
  email: '',
  role: 'viewer',
  recoveryEnabled: false,
};

export function useTrustedContactsWorkspace() {
  const { user } = useAuth();

  const [contacts, setContacts] = useState<TrustedContactResponse[]>([]);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [draft, setDraft] = useState<TrustedContactDraft>(INITIAL_DRAFT);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const refreshContacts = async () => {
    try {
      const listed = await apiClient.listTrustedContacts();
      setContacts(listed);
      return listed;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load trusted contacts.'));
      return [];
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshContacts();
  }, [user]);

  const createContact = async () => {
    setLoadingAction('create');
    setError('');
    setFeedback('');

    try {
      const created = await apiClient.createTrustedContact({
        body: {
          name: draft.name.trim(),
          email: draft.email.trim(),
          role: draft.role,
          recovery_enabled: draft.recoveryEnabled,
        },
      });
      setContacts((current) => [created, ...current]);
      setDraft(INITIAL_DRAFT);
      setFeedback('Trusted contact created.');
      return created;
    } catch (createError) {
      setError(readApiErrorMessage(createError, 'Unable to create trusted contact.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const inviteContact = async (contactId: string) => {
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
      return response;
    } catch (inviteError) {
      setError(readApiErrorMessage(inviteError, 'Unable to send invite.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const acceptInvite = async () => {
    setLoadingAction('accept');
    setError('');
    setFeedback('');

    try {
      const response = await apiClient.acceptTrustedContactInvite({ token: inviteTokenInput.trim() });
      await refreshContacts();
      setFeedback(response.message);
      setInviteTokenInput('');
      return response;
    } catch (acceptError) {
      setError(readApiErrorMessage(acceptError, 'Unable to accept invite.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const revokeContact = async (contactId: string) => {
    setLoadingAction(`revoke-${contactId}`);
    setError('');
    setFeedback('');

    try {
      await apiClient.revokeTrustedContact({ trustedContactId: contactId });
      await refreshContacts();
      setFeedback('Trusted contact revoked.');
      return true;
    } catch (revokeError) {
      setError(readApiErrorMessage(revokeError, 'Unable to revoke trusted contact.'));
      return false;
    } finally {
      setLoadingAction('');
    }
  };

  return {
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
    refreshContacts,
  };
}
