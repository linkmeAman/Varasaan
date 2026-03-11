'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient, type InventoryResponse } from '../lib/api-client';

const LOCAL_STORAGE_KEY = 'varasaan.inventory.accounts';

type StorageMode = 'api' | 'local';

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

function readLocalAccounts(): InventoryResponse[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: InventoryResponse[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts));
}

function createLocalInventoryEntry(state: NewAccountState): InventoryResponse {
  const randomPart =
    typeof window !== 'undefined' && window.crypto ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  return {
    id: `local-${randomPart}`,
    platform: state.platform,
    category: state.category,
    username_hint: state.usernameHint || null,
    importance_level: state.importanceLevel,
  };
}

export default function Inventory() {
  const [form, setForm] = useState<NewAccountState>(INITIAL_FORM);
  const [accounts, setAccounts] = useState<InventoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadAccounts = async () => {
      const hasAccessToken =
        typeof window !== 'undefined' && Boolean(window.localStorage.getItem('access_token'));

      if (hasAccessToken) {
        try {
          const remoteAccounts = await apiClient.listInventoryAccounts();
          if (!mounted) {
            return;
          }

          setAccounts(remoteAccounts);
          setStorageMode('api');
          setIsLoading(false);
          return;
        } catch {
          // Fall through to local mode when auth/token/backend is unavailable.
        }
      }

      if (!mounted) {
        return;
      }

      setAccounts(readLocalAccounts());
      setStorageMode('local');
      setIsLoading(false);
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, []);

  const handleFieldChange = <K extends keyof NewAccountState>(field: K, value: NewAccountState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addLocalAccount = (state: NewAccountState) => {
    const created = createLocalInventoryEntry(state);
    const updated = [created, ...accounts];
    setAccounts(updated);
    writeLocalAccounts(updated);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next: NewAccountState = {
      platform: form.platform.trim(),
      category: form.category.trim(),
      usernameHint: form.usernameHint.trim(),
      importanceLevel: Math.max(1, Math.min(5, Number(form.importanceLevel) || 3)),
    };

    if (!next.platform || !next.category) {
      setFeedback('Platform and category are required.');
      return;
    }

    setIsSubmitting(true);
    setFeedback('');

    if (storageMode === 'api') {
      try {
        const created = await apiClient.createInventoryAccount({
          body: {
            platform: next.platform,
            category: next.category,
            username_hint: next.usernameHint || null,
            importance_level: next.importanceLevel,
          },
        });

        setAccounts((current) => [created, ...current]);
        setForm(INITIAL_FORM);
        setFeedback('Account added to backend inventory.');
        setIsSubmitting(false);
        return;
      } catch {
        setStorageMode('local');
      }
    }

    addLocalAccount(next);
    setForm(INITIAL_FORM);
    setFeedback('Account saved locally. Sign in with API auth token to persist to backend.');
    setIsSubmitting(false);
  };

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Inventory Accounts</h1>
        <p className="dash-subtitle">
          Add accounts here. Current storage mode: <strong>{storageMode === 'api' ? 'Backend API' : 'Local browser'}</strong>
        </p>
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
          <Button type="submit" className="inventory-submit" isLoading={isSubmitting}>
            <Plus size={16} /> Add Account
          </Button>
        </form>
        {feedback && <p className="inventory-feedback">{feedback}</p>}
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Saved Accounts</h2>
        {isLoading ? (
          <p className="inventory-empty">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="inventory-empty">No accounts yet. Add your first account above.</p>
        ) : (
          <div className="inventory-list">
            {accounts.map((account) => (
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
