'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileArchive, FolderOpen, Plus, ShieldAlert, Users } from 'lucide-react';

import { apiClient, type DocumentSummaryResponse, type InventoryResponse, type TrustedContactResponse } from '../lib/api-client';
import { useAuthGuard } from '../lib/use-auth-guard';

export default function Dashboard() {
  const { isLoading: authLoading, user } = useAuthGuard();
  const [inventoryAccounts, setInventoryAccounts] = useState<InventoryResponse[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContactResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentSummaryResponse[]>([]);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [inventory, contacts, docs] = await Promise.all([
          apiClient.listInventoryAccounts(),
          apiClient.listTrustedContacts(),
          apiClient.listDocuments(),
        ]);
        if (!mounted) {
          return;
        }
        setInventoryAccounts(inventory);
        setTrustedContacts(contacts);
        setDocuments(docs);
      } catch {
        if (!mounted) {
          return;
        }
        setFeedback('Unable to load dashboard metrics right now.');
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const riskyAccounts = useMemo(() => inventoryAccounts.filter((account) => account.importance_level >= 4).length, [inventoryAccounts]);
  const activeContacts = useMemo(
    () => trustedContacts.filter((contact) => contact.status === 'active').length,
    [trustedContacts],
  );
  const activeDocuments = useMemo(
    () => documents.filter((document) => document.state === 'active').length,
    [documents],
  );

  if (authLoading) {
    return (
      <div className="dashboard-container animate-fade-in">
        <p className="inventory-empty">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Digital Inventory</h1>
          <p className="dash-subtitle">Planning Mode for {user?.email}</p>
        </div>
        <Link href="/dashboard/inventory" className="dash-cta">
          <Plus size={18} /> Add Account
        </Link>
      </header>

      {feedback && <p className="input-error-msg">{feedback}</p>}

      <div className="dash-stats">
        <div className="stat-card glass-panel">
          <div className="stat-icon info">
            <FolderOpen size={24} />
          </div>
          <div className="stat-data">
            <h3>{inventoryAccounts.length}</h3>
            <p>Mapped Accounts</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon warning">
            <ShieldAlert size={24} />
          </div>
          <div className="stat-data">
            <h3>{riskyAccounts}</h3>
            <p>High Priority Accounts</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon success">
            <Users size={24} />
          </div>
          <div className="stat-data">
            <h3>{activeContacts} / {trustedContacts.length}</h3>
            <p>Active Trusted Contacts</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon info">
            <FileArchive size={24} />
          </div>
          <div className="stat-data">
            <h3>{activeDocuments} / {documents.length}</h3>
            <p>Scanned Documents</p>
          </div>
        </div>
      </div>

      <section className="inventory-section">
        <h2 className="section-title">Workspace</h2>
        <div className="inventory-list">
          <Link href="/dashboard/inventory" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Inventory</div>
              <h4>Manage Accounts</h4>
              <p className="item-secondary">Create, edit, and prioritize digital accounts.</p>
            </div>
          </Link>

          <Link href="/dashboard/trusted-contacts" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Contacts</div>
              <h4>Trusted Contacts</h4>
              <p className="item-secondary">Invite executors and manage recovery assistants.</p>
            </div>
          </Link>

          <Link href="/dashboard/documents" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Documents</div>
              <h4>Document Vault</h4>
              <p className="item-secondary">Upload, scan, grant, and download legal documents.</p>
            </div>
          </Link>

          <Link href="/dashboard/packets" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Packets</div>
              <h4>Generate Packet Jobs</h4>
              <p className="item-secondary">Start legal packet generation by platform.</p>
            </div>
          </Link>

          <Link href="/dashboard/exports" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Exports</div>
              <h4>Export Bundles</h4>
              <p className="item-secondary">Issue one-time tokenized downloads for exports.</p>
            </div>
          </Link>

          <Link href="/dashboard/billing" className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge">Payments</div>
              <h4>Checkout and Billing</h4>
              <p className="item-secondary">Create checkout orders and track payment status.</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
