'use client';

import { useEffect, useState } from 'react';

import {
  apiClient,
  type DocumentDetailResponse,
  type DocumentSummaryResponse,
  type TrustedContactResponse,
} from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';
import { sleep } from './sleep';
import { uploadWithProgress } from './upload-with-progress';

export type DocumentGrantDraft = {
  documentId: string;
  contactId: string;
  reason: string;
  expiresInHours: string;
};

const INITIAL_GRANT_DRAFT: DocumentGrantDraft = {
  documentId: '',
  contactId: '',
  reason: '',
  expiresInHours: '72',
};

export function useDocumentsWorkspace() {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<DocumentSummaryResponse[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContactResponse[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetailResponse | null>(null);
  const [grantDraft, setGrantDraft] = useState<DocumentGrantDraft>(INITIAL_GRANT_DRAFT);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const refreshDocuments = async () => {
    try {
      const [listedDocuments, listedContacts] = await Promise.all([apiClient.listDocuments(), apiClient.listTrustedContacts()]);
      setDocuments(listedDocuments);
      setTrustedContacts(listedContacts.filter((contact) => contact.status === 'active'));
      return listedDocuments;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load document workspace.'));
      return [];
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshDocuments();
  }, [user]);

  useEffect(() => {
    const hasPendingScan = documents.some((document) => {
      const scanStatus = document.current_version?.scan_status;
      return document.state === 'active' && (!scanStatus || scanStatus === 'pending');
    });

    if (!hasPendingScan) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshDocuments();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [documents]);

  const uploadDocument = async (docType: string, file: File) => {
    if (!file) {
      setError('Please select a file first.');
      return null;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File must be 50MB or smaller.');
      return null;
    }

    setLoadingAction('upload');
    setError('');
    setFeedback('');
    setUploadProgress(0);

    try {
      const init = await apiClient.initDocumentUpload({
        body: {
          doc_type: docType.trim(),
          size_bytes: file.size,
          content_type: file.type || 'application/octet-stream',
          sha256: null,
        },
      });

      await uploadWithProgress({
        url: init.upload_url,
        file,
        contentType: file.type || 'application/octet-stream',
        onProgress: setUploadProgress,
      });

      await apiClient.queueDocumentScan({ versionId: init.version_id });

      let latestDocuments = await refreshDocuments();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const matching = latestDocuments.find((document) => document.id === init.document_id);
        const scanStatus = matching?.current_version?.scan_status;
        if (scanStatus && scanStatus !== 'pending') {
          break;
        }
        await sleep(2000);
        latestDocuments = await refreshDocuments();
      }

      setFeedback('Document uploaded and scan queued.');
      return init.document_id;
    } catch (uploadError) {
      setError(readApiErrorMessage(uploadError, 'Document upload failed.'));
      return null;
    } finally {
      setLoadingAction('');
      setUploadProgress(0);
    }
  };

  const selectDocument = async (documentId: string) => {
    setLoadingAction(`view-${documentId}`);
    setError('');

    try {
      const detail = await apiClient.getDocument({ documentId });
      setSelectedDocument(detail);
      return detail;
    } catch (viewError) {
      setError(readApiErrorMessage(viewError, 'Unable to fetch document details.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const downloadDocument = async (documentId: string) => {
    setLoadingAction(`download-${documentId}`);
    setError('');

    try {
      const response = await apiClient.getDocumentDownloadUrl({ documentId });
      window.open(response.download_url, '_blank', 'noopener,noreferrer');
      return response;
    } catch (downloadError) {
      setError(readApiErrorMessage(downloadError, 'Unable to get download URL.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const deleteDocument = async (documentId: string) => {
    setLoadingAction(`delete-${documentId}`);
    setError('');
    setFeedback('');

    try {
      await apiClient.softDeleteDocument({ documentId });
      await refreshDocuments();
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
      }
      setFeedback('Document soft deleted.');
      return true;
    } catch (deleteError) {
      setError(readApiErrorMessage(deleteError, 'Unable to delete document.'));
      return false;
    } finally {
      setLoadingAction('');
    }
  };

  const createGrant = async () => {
    if (!grantDraft.documentId || !grantDraft.contactId) {
      setError('Document and trusted contact are required for grants.');
      return null;
    }

    setLoadingAction('grant');
    setError('');
    setFeedback('');

    try {
      const response = await apiClient.createDocumentGrant({
        documentId: grantDraft.documentId,
        body: {
          trusted_contact_id: grantDraft.contactId,
          granted_reason: grantDraft.reason.trim() || null,
          expires_in_hours: Number(grantDraft.expiresInHours) || null,
        },
      });
      setFeedback('Document grant created.');
      setGrantDraft((current) => ({ ...current, reason: '' }));
      return response;
    } catch (grantError) {
      setError(readApiErrorMessage(grantError, 'Unable to create grant.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  return {
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
    refreshDocuments,
  };
}
