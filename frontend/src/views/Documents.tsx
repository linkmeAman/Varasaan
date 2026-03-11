'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FilePlus, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  apiClient,
  type DocumentDetailResponse,
  type DocumentSummaryResponse,
  type TrustedContactResponse,
} from '../lib/api-client';
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

export default function Documents() {
  const { isLoading: authLoading, user } = useAuthGuard();

  const [documents, setDocuments] = useState<DocumentSummaryResponse[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContactResponse[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetailResponse | null>(null);

  const [docType, setDocType] = useState('death_certificate');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [grantDocumentId, setGrantDocumentId] = useState('');
  const [grantContactId, setGrantContactId] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantExpiresHours, setGrantExpiresHours] = useState('72');

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const loadDocuments = async () => {
    const listed = await apiClient.listDocuments();
    setDocuments(listed);
  };


  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [listedDocuments, listedContacts] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.listTrustedContacts(),
        ]);
        if (!mounted) {
          return;
        }
        setDocuments(listedDocuments);
        setTrustedContacts(listedContacts.filter((contact) => contact.status === 'active'));
      } catch {
        if (mounted) {
          setError('Unable to load document vault state.');
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File must be 50MB or smaller.');
      return;
    }

    setLoadingAction('upload');
    setError('');
    setFeedback('');

    try {
      const init = await apiClient.initDocumentUpload({
        body: {
          doc_type: docType.trim(),
          size_bytes: selectedFile.size,
          content_type: selectedFile.type || 'application/octet-stream',
          sha256: null,
        },
      });

      const uploadResponse = await fetch(init.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`upload_failed_${uploadResponse.status}`);
      }

      await apiClient.queueDocumentScan({ versionId: init.version_id });
      await loadDocuments();
      setSelectedFile(null);
      setFeedback('Document uploaded and scan queued.');
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Document upload failed.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleViewDocument = async (documentId: string) => {
    setLoadingAction(`view-${documentId}`);
    setError('');

    try {
      const detail = await apiClient.getDocument({ documentId });
      setSelectedDocument(detail);
    } catch (viewError) {
      setError(errorMessage(viewError, 'Unable to fetch document details.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleDownload = async (documentId: string) => {
    setLoadingAction(`download-${documentId}`);
    setError('');

    try {
      const response = await apiClient.getDocumentDownloadUrl({ documentId });
      window.open(response.download_url, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(errorMessage(downloadError, 'Unable to get download URL.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleDelete = async (documentId: string) => {
    setLoadingAction(`delete-${documentId}`);
    setError('');
    setFeedback('');

    try {
      await apiClient.softDeleteDocument({ documentId });
      await loadDocuments();
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
      }
      setFeedback('Document soft deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete document.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleCreateGrant = async (event: FormEvent) => {
    event.preventDefault();

    if (!grantDocumentId || !grantContactId) {
      setError('Document and trusted contact are required for grants.');
      return;
    }

    setLoadingAction('grant');
    setError('');
    setFeedback('');

    try {
      await apiClient.createDocumentGrant({
        documentId: grantDocumentId,
        body: {
          trusted_contact_id: grantContactId,
          granted_reason: grantReason.trim() || null,
          expires_in_hours: Number(grantExpiresHours) || null,
        },
      });
      setFeedback('Document grant created.');
      setGrantReason('');
    } catch (grantError) {
      setError(errorMessage(grantError, 'Unable to create grant.'));
    } finally {
      setLoadingAction('');
    }
  };

  if (authLoading) {
    return (
      <div className="inventory-manager animate-fade-in">
        <p className="inventory-empty">Loading document vault...</p>
      </div>
    );
  }

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Document Vault</h1>
        <p className="dash-subtitle">Upload encrypted documents, monitor scans, and manage access grants.</p>
      </div>

      {feedback && <p className="inventory-feedback">{feedback}</p>}
      {error && <p className="input-error-msg">{error}</p>}

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Upload Document</h2>
        <form className="inventory-form" onSubmit={handleUpload}>
          <div className="inventory-form-grid">
            <Input label="Document Type" value={docType} onChange={(event) => setDocType(event.target.value)} required />
            <Input label="Document File" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} required />
          </div>
          <Button type="submit" isLoading={loadingAction === 'upload'}>
            <FilePlus size={16} /> Upload and Scan
          </Button>
        </form>
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Document Access Grant</h2>
        <form className="inventory-form" onSubmit={handleCreateGrant}>
          <div className="inventory-form-grid">
            <label className="input-label" htmlFor="grant-document">
              Document <span className="input-required">*</span>
            </label>
            <select
              id="grant-document"
              className="input-field"
              value={grantDocumentId}
              onChange={(event) => setGrantDocumentId(event.target.value)}
              required
            >
              <option value="">Select a document</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.doc_type} ({document.state})
                </option>
              ))}
            </select>

            <label className="input-label" htmlFor="grant-contact">
              Trusted Contact <span className="input-required">*</span>
            </label>
            <select
              id="grant-contact"
              className="input-field"
              value={grantContactId}
              onChange={(event) => setGrantContactId(event.target.value)}
              required
            >
              <option value="">Select an active contact</option>
              {trustedContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.email})
                </option>
              ))}
            </select>

            <Input label="Reason" value={grantReason} onChange={(event) => setGrantReason(event.target.value)} />
            <Input
              label="Expires In Hours"
              type="number"
              min={1}
              value={grantExpiresHours}
              onChange={(event) => setGrantExpiresHours(event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" isLoading={loadingAction === 'grant'}>
            <ShieldCheck size={16} /> Create Grant
          </Button>
        </form>
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Documents</h2>
        {documents.length === 0 ? (
          <p className="inventory-empty">No documents uploaded yet.</p>
        ) : (
          <div className="inventory-list">
            {documents.map((document) => (
              <div key={document.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">{document.doc_type}</div>
                  <h4>{document.id}</h4>
                  <p className="item-secondary">state: {document.state}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${document.state === 'active' ? 'success' : 'warning'}`}>
                    {document.current_version?.scan_status || 'pending'}
                  </span>
                </div>
                <div className="inventory-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleViewDocument(document.id)}
                    isLoading={loadingAction === `view-${document.id}`}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleDownload(document.id)}
                    isLoading={loadingAction === `download-${document.id}`}
                    disabled={document.state !== 'active'}
                  >
                    <Download size={14} /> Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleDelete(document.id)}
                    isLoading={loadingAction === `delete-${document.id}`}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDocument && (
        <section className="inventory-panel glass-panel">
          <h2 className="section-title">Selected Document Versions</h2>
          <div className="inventory-list">
            {selectedDocument.versions.map((version) => (
              <div key={version.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">version {version.version_no}</div>
                  <h4>{version.id}</h4>
                  <p className="item-secondary">{version.object_key}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${version.scan_status === 'clean' ? 'success' : 'warning'}`}>
                    {version.scan_status || version.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


