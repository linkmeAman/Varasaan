'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiClient, type InventoryResponse } from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';

export type InventoryDraft = {
  platform: string;
  category: string;
  usernameHint: string;
  importanceLevel: number;
};

function normalizeDraft(draft: InventoryDraft): InventoryDraft {
  return {
    platform: draft.platform.trim(),
    category: draft.category.trim(),
    usernameHint: draft.usernameHint.trim(),
    importanceLevel: Math.max(1, Math.min(5, Number(draft.importanceLevel) || 3)),
  };
}

function createOptimisticId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `optimistic-${crypto.randomUUID()}`;
  }

  return `optimistic-${Date.now()}`;
}

export function useInventoryWorkspace() {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<InventoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.importance_level - a.importance_level),
    [accounts],
  );

  const refreshAccounts = async () => {
    setIsLoading(true);
    setError('');

    try {
      const remoteAccounts = await apiClient.listInventoryAccounts();
      setAccounts(remoteAccounts);
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load inventory accounts.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshAccounts();
  }, [user]);

  const createAccount = async (draft: InventoryDraft) => {
    const next = normalizeDraft(draft);
    if (!next.platform || !next.category) {
      setError('Platform and category are required.');
      return null;
    }

    setSubmittingAction('create');
    setFeedback('');
    setError('');

    const optimisticId = createOptimisticId();
    const optimisticAccount: InventoryResponse = {
      id: optimisticId,
      platform: next.platform,
      category: next.category,
      username_hint: next.usernameHint || null,
      importance_level: next.importanceLevel,
    };

    setAccounts((current) => [optimisticAccount, ...current]);

    try {
      const created = await apiClient.createInventoryAccount({
        body: {
          platform: next.platform,
          category: next.category,
          username_hint: next.usernameHint || null,
          importance_level: next.importanceLevel,
        },
      });

      setAccounts((current) => current.map((account) => (account.id === optimisticId ? created : account)));
      setFeedback('Account added to backend inventory.');
      return created;
    } catch (submitError) {
      setAccounts((current) => current.filter((account) => account.id !== optimisticId));
      setError(readApiErrorMessage(submitError, 'Unable to save inventory account.'));
      return null;
    } finally {
      setSubmittingAction('');
    }
  };

  const updateAccount = async (accountId: string, draft: InventoryDraft) => {
    const next = normalizeDraft(draft);
    if (!next.platform || !next.category) {
      setError('Platform and category are required.');
      return null;
    }

    const previous = accounts.find((account) => account.id === accountId);
    if (!previous) {
      setError('Inventory account not found.');
      return null;
    }

    setSubmittingAction(`update-${accountId}`);
    setFeedback('');
    setError('');

    const optimisticAccount: InventoryResponse = {
      ...previous,
      platform: next.platform,
      category: next.category,
      username_hint: next.usernameHint || null,
      importance_level: next.importanceLevel,
    };

    setAccounts((current) => current.map((account) => (account.id === accountId ? optimisticAccount : account)));

    try {
      const updated = await apiClient.updateInventoryAccount({
        accountId,
        body: {
          platform: next.platform,
          category: next.category,
          username_hint: next.usernameHint || null,
          importance_level: next.importanceLevel,
        },
      });

      setAccounts((current) => current.map((account) => (account.id === accountId ? updated : account)));
      setFeedback('Inventory account updated.');
      return updated;
    } catch (submitError) {
      setAccounts((current) => current.map((account) => (account.id === accountId ? previous : account)));
      setError(readApiErrorMessage(submitError, 'Unable to save inventory account.'));
      return null;
    } finally {
      setSubmittingAction('');
    }
  };

  const deleteAccount = async (accountId: string) => {
    const previous = accounts;

    setSubmittingAction(`delete-${accountId}`);
    setFeedback('');
    setError('');
    setAccounts((current) => current.filter((account) => account.id !== accountId));

    try {
      await apiClient.deleteInventoryAccount({ accountId });
      setFeedback('Inventory account deleted.');
      return true;
    } catch (deleteError) {
      setAccounts(previous);
      setError(readApiErrorMessage(deleteError, 'Unable to delete inventory account.'));
      return false;
    } finally {
      setSubmittingAction('');
    }
  };

  return {
    accounts: sortedAccounts,
    isLoading,
    feedback,
    error,
    submittingAction,
    refreshAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
