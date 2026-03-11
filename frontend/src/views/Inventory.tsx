'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient, type InventoryResponse } from '../lib/api-client';
import { useAuthGuard } from '../lib/use-auth-guard';

type NewAccountState = {
  platform: string;
  category: string;
  usernameHint: string;
  importanceLevel: number;
};

const INITIAL_FORM: NewAccountState = {
  platform: '',
  category: '',
  usernameHint: '',
  importanceLevel: 3,
};

function normalizeForm(state: NewAccountState): NewAccountState {
  return {
    platform: state.platform.trim(),
    category: state.category.trim(),
    usernameHint: state.usernameHint.trim(),
    importanceLevel: Math.max(1, Math.min(5, Number(state.importanceLevel) || 3)),
  };
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export default function Inventory() {
  const { isLoading: authLoading, user } = useAuthGuard();

  const [form, setForm] = useState<NewAccountState>(INITIAL_FORM);
  const [accounts, setAccounts] = useState<InventoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;
    const loadAccounts = async () => {
      setIsLoading(true);
      try {
        const remoteAccounts = await apiClient.listInventoryAccounts();
        if (!mounted) {
          return;
        }
        setAccounts(remoteAccounts);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(apiErrorMessage(loadError, 'Unable to load inventory accounts.'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.importance_level - a.importance_level),
    [accounts],
  );

  const handleFieldChange = <K extends keyof NewAccountState>(field: K, value: NewAccountState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = normalizeForm(form);
    if (!next.platform || !next.category) {
      setError('Platform and category are required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setFeedback('');

    try {
      if (editingAccountId) {
        const updated = await apiClient.updateInventoryAccount({
          accountId: editingAccountId,
          body: {
            platform: next.platform,
            category: next.category,
            username_hint: next.usernameHint || null,
            importance_level: next.importanceLevel,
          },
        });

        setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setFeedback('Inventory account updated.');
      } else {
        const created = await apiClient.createInventoryAccount({
          body: {
            platform: next.platform,
            category: next.category,
            username_hint: next.usernameHint || null,
            importance_level: next.importanceLevel,
          },
        });

        setAccounts((current) => [created, ...current]);
        setFeedback('Account added to backend inventory.');
      }

      setForm(INITIAL_FORM);
      setEditingAccountId(null);
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'Unable to save inventory account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: InventoryResponse) => {
    setEditingAccountId(account.id);
    setForm({
      platform: account.platform,
      category: account.category,
      usernameHint: account.username_hint || '',
      importanceLevel: account.importance_level,
    });
    setFeedback('');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setForm(INITIAL_FORM);
    setFeedback('');
    setError('');
  };

  const handleDelete = async (accountId: string) => {
    setError('');
    setFeedback('');

    try {
      await apiClient.deleteInventoryAccount({ accountId });
      setAccounts((current) => current.filter((item) => item.id !== accountId));
      if (editingAccountId === accountId) {
        handleCancelEdit();
      }
      setFeedback('Inventory account deleted.');
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError, 'Unable to delete inventory account.'));
    }
  };

  if (authLoading) {
    return (
      <div className="inventory-manager animate-fade-in">
        <p className="inventory-empty">Loading inventory workspace...</p>
      </div>
    );
  }

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Inventory Accounts</h1>
        <p className="dash-subtitle">Create, update, and remove account inventory entries.</p>
      </div>

      <section className="inventory-panel glass-panel">
        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="inventory-form-grid">
            <Input
              label="Platform"
              placeholder="e.g. Gmail"
              value={form.platform}
              onChange={(event) => handleFieldChange('platform', event.target.value)}
              required
            />
            <Input
              label="Category"
              placeholder="e.g. Communication"
              value={form.category}
              onChange={(event) => handleFieldChange('category', event.target.value)}
              required
            />
            <Input
              label="Username Hint"
              placeholder="you@example.com"
              value={form.usernameHint}
              onChange={(event) => handleFieldChange('usernameHint', event.target.value)}
            />
            <Input
              label="Importance (1-5)"
              type="number"
              min={1}
              max={5}
              value={String(form.importanceLevel)}
              onChange={(event) => handleFieldChange('importanceLevel', Number(event.target.value))}
              required
            />
          </div>

          <div className="inventory-actions-row">
            <Button type="submit" className="inventory-submit" isLoading={isSubmitting}>
              {editingAccountId ? <Save size={16} /> : <Plus size={16} />}
              {editingAccountId ? 'Update Account' : 'Add Account'}
            </Button>
            {editingAccountId && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                <X size={16} /> Cancel Edit
              </Button>
            )}
          </div>
        </form>
        {feedback && <p className="inventory-feedback">{feedback}</p>}
        {error && <p className="input-error-msg">{error}</p>}
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Saved Accounts</h2>
        {isLoading ? (
          <p className="inventory-empty">Loading accounts...</p>
        ) : sortedAccounts.length === 0 ? (
          <p className="inventory-empty">No accounts yet. Add your first account above.</p>
        ) : (
          <div className="inventory-list">
            {sortedAccounts.map((account) => (
              <div key={account.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">{account.category}</div>
                  <h4>{account.platform}</h4>
                  <p className="item-secondary">{account.username_hint || 'No username hint provided'}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${account.importance_level >= 4 ? 'warning' : 'success'}`}>
                    Priority {account.importance_level}
                  </span>
                </div>
                <div className="inventory-item-actions">
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleEdit(account)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => void handleDelete(account.id)}>
                    <Trash2 size={14} /> Delete
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
