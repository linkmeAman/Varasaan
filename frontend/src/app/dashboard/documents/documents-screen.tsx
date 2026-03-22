'use client';

import { Download, FileScan, ShieldCheck, Trash2 } from 'lucide-react';

import { DocumentUploader } from '../../../components/documents/DocumentUploader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useDocumentsWorkspace } from '../../../lib/use-documents-workspace';

export function DocumentsScreen() {
  const {
    documents,
    trustedContacts,
    selectedDocument,
    grantDraft,
    feedback,
    error,
    loadingAction,
    uploadProgress,
    setGrantDraft,
    uploadDocument,
    selectDocument,
    downloadDocument,
    deleteDocument,
    createGrant,
  } = useDocumentsWorkspace();

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Documents</p>
          <h2 className="dash-title">Document Workspace</h2>
          <p className="dash-subtitle">Upload planning and legal documents, monitor scans, and manage access grants.</p>
        </div>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Upload Document</h3>
        <DocumentUploader
          isUploading={loadingAction === 'upload'}
          progress={uploadProgress}
          onUpload={async (docType, file) => {
            await uploadDocument(docType, file);
          }}
        />
      </section>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Document Access Grant</h3>
        <div className="inventory-form">
          <div className="inventory-form-grid">
            <label className="input-label" htmlFor="grant-document">
              Document <span className="input-required">*</span>
            </label>
            <select
              id="grant-document"
              className="input-field"
              value={grantDraft.documentId}
              onChange={(event) => setGrantDraft((current) => ({ ...current, documentId: event.target.value }))}
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
              value={grantDraft.contactId}
              onChange={(event) => setGrantDraft((current) => ({ ...current, contactId: event.target.value }))}
            >
              <option value="">Select an active contact</option>
              {trustedContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.email})
                </option>
              ))}
            </select>

            <Input
              label="Reason"
              value={grantDraft.reason}
              onChange={(event) => setGrantDraft((current) => ({ ...current, reason: event.target.value }))}
            />
            <Input
              label="Expires In Hours"
              type="number"
              min={1}
              value={grantDraft.expiresInHours}
              onChange={(event) => setGrantDraft((current) => ({ ...current, expiresInHours: event.target.value }))}
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => void createGrant()} isLoading={loadingAction === 'grant'}>
            <ShieldCheck size={16} /> Create Grant
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Documents</h3>
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
                  <span className={`status-indicator ${document.current_version?.scan_status === 'clean' ? 'success' : 'warning'}`}>
                    {document.current_version?.scan_status || 'pending'}
                  </span>
                </div>
                <div className="inventory-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void selectDocument(document.id)}
                    isLoading={loadingAction === `view-${document.id}`}
                  >
                    <FileScan size={14} /> View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void downloadDocument(document.id)}
                    isLoading={loadingAction === `download-${document.id}`}
                    disabled={document.state !== 'active'}
                  >
                    <Download size={14} /> Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void deleteDocument(document.id)}
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

      {selectedDocument ? (
        <section className="inventory-panel glass-panel">
          <h3 className="section-title">Selected Document Versions</h3>
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
      ) : null}
    </div>
  );
}
