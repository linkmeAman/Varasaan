'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { type InventoryResponse } from '../../../lib/api-client';
import { useInventoryWorkspace } from '../../../lib/use-inventory-workspace';

const inventorySchema = z.object({
  platform: z.string().min(1, 'Platform is required.'),
  category: z.string().min(1, 'Category is required.'),
  usernameHint: z.string().optional(),
  importanceLevel: z.number().min(1).max(5),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

const DEFAULT_VALUES: InventoryFormValues = {
  platform: '',
  category: '',
  usernameHint: '',
  importanceLevel: 3,
};

export function InventoryScreen() {
  const { accounts, isLoading, feedback, error, submittingAction, createAccount, updateAccount, deleteAccount } =
    useInventoryWorkspace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<InventoryResponse | null>(null);

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: DEFAULT_VALUES,
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
    form.reset(DEFAULT_VALUES);
  };

  useEffect(() => {
    if (editingAccount) {
      form.reset({
        platform: editingAccount.platform,
        category: editingAccount.category,
        usernameHint: editingAccount.username_hint || '',
        importanceLevel: editingAccount.importance_level,
      });
      return;
    }

    if (isDialogOpen) {
      form.reset(DEFAULT_VALUES);
    }
  }, [editingAccount, form, isDialogOpen]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      platform: values.platform,
      category: values.category,
      usernameHint: values.usernameHint || '',
      importanceLevel: values.importanceLevel,
    };

    const result = editingAccount ? await updateAccount(editingAccount.id, payload) : await createAccount(payload);
    if (result) {
      closeDialog();
    }
  });

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Inventory</p>
          <h2 className="dash-title">Inventory Accounts</h2>
          <p className="dash-subtitle">Create, update, and remove account inventory entries.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingAccount(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus size={16} /> Add Account
        </Button>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }
          setIsDialogOpen(true);
        }}
        title={editingAccount ? 'Edit inventory account' : 'Add inventory account'}
        description="Capture the account and how critical it is for recovery planning."
      >
        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="inventory-form-grid">
            <Input label="Platform" placeholder="e.g. Gmail" error={form.formState.errors.platform?.message} {...form.register('platform')} />
            <Input
              label="Category"
              placeholder="e.g. Communication"
              error={form.formState.errors.category?.message}
              {...form.register('category')}
            />
            <Input
              label="Username Hint"
              placeholder="you@example.com"
              error={form.formState.errors.usernameHint?.message}
              {...form.register('usernameHint')}
            />
            <Input
              label="Importance (1-5)"
              type="number"
              min={1}
              max={5}
              error={form.formState.errors.importanceLevel?.message}
              {...form.register('importanceLevel', { valueAsNumber: true })}
            />
          </div>

          <div className="inventory-actions-row">
            <Button type="submit" isLoading={Boolean(submittingAction)}>
              {editingAccount ? <Save size={16} /> : <Plus size={16} />}
              {editingAccount ? 'Update Account' : 'Add Account'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Saved Accounts</h3>
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
                <div className="inventory-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingAccount(account);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void deleteAccount(account.id)}
                    isLoading={submittingAction === `delete-${account.id}`}
                  >
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
