'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, KeyRound, PackagePlus, RefreshCw } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { apiClient, type ExportJobResponse } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

const EXPORT_JOBS_STORAGE_KEY = 'varasaan.export.jobs';

function readStoredExportJobIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(EXPORT_JOBS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredExportJobIds(ids: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(EXPORT_JOBS_STORAGE_KEY, JSON.stringify(ids));
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export default function Exports() {
  const { isLoading: authLoading, user } = useAuth();

  const [jobs, setJobs] = useState<ExportJobResponse[]>([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const hasInFlightJobs = useMemo(
    () => jobs.some((job) => job.status === 'queued' || job.status === 'processing'),
    [jobs],
  );

  const refreshJobs = async () => {
    const ids = readStoredExportJobIds();
    if (!ids.length) {
      setJobs([]);
      return;
    }

    const settled = await Promise.allSettled(ids.map((id) => apiClient.getExportStatus({ exportJobId: id })));
    const succeeded = settled
      .filter((result): result is PromiseFulfilledResult<ExportJobResponse> => result.status === 'fulfilled')
      .map((result) => result.value);
    setJobs(succeeded);
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        await refreshJobs();
      } catch {
        if (mounted) {
          setError('Unable to load export jobs.');
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!hasInFlightJobs) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshJobs();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasInFlightJobs]);

  const handleCreateExport = async () => {
    setLoadingAction('create');
    setFeedback('');
    setError('');

    try {
      const created = await apiClient.createExportJob();
      const existing = readStoredExportJobIds();
      const nextIds = [created.id, ...existing.filter((item) => item !== created.id)];
      writeStoredExportJobIds(nextIds);

      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setFeedback('Export job queued.');
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to create export job.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleOwnerDownload = async (jobId: string) => {
    setLoadingAction(`download-owner-${jobId}`);
    setFeedback('');
    setError('');

    try {
      const response = await apiClient.ownerExportDownload({ exportJobId: jobId });
      window.open(response.download_url, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(errorMessage(downloadError, 'Unable to generate owner download URL.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleTokenDownload = async (jobId: string) => {
    setLoadingAction(`download-token-${jobId}`);
    setFeedback('');
    setError('');

    try {
      const token = await apiClient.issueExportToken({ exportJobId: jobId });
      const download = await apiClient.tokenExportDownload({
        exportJobId: jobId,
        token: token.one_time_token,
      });
      window.open(download.download_url, '_blank', 'noopener,noreferrer');
      setFeedback(`One-time token used: ${token.one_time_token}`);
    } catch (downloadError) {
      setError(errorMessage(downloadError, 'Unable to complete tokenized download.'));
    } finally {
      setLoadingAction('');
    }
  };

  if (authLoading) {
    return (
      <div className="inventory-manager animate-fade-in">
        <p className="inventory-empty">Loading exports workspace...</p>
      </div>
    );
  }

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Exports</h1>
        <p className="dash-subtitle">Create exports and download bundles securely.</p>
      </div>

      {feedback && <p className="inventory-feedback">{feedback}</p>}
      {error && <p className="input-error-msg">{error}</p>}

      <section className="inventory-panel glass-panel">
        <div className="inventory-actions-row">
          <Button type="button" onClick={handleCreateExport} isLoading={loadingAction === 'create'}>
            <PackagePlus size={16} /> Create Export Job
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refreshJobs()}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Recent Export Jobs</h2>
        {jobs.length === 0 ? (
          <p className="inventory-empty">No export jobs yet.</p>
        ) : (
          <div className="inventory-list">
            {jobs.map((job) => (
              <div key={job.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">export</div>
                  <h4>{job.id}</h4>
                  <p className="item-secondary">status: {job.status}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${job.status === 'ready' ? 'success' : 'warning'}`}>{job.status}</span>
                </div>
                <div className="inventory-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={job.status !== 'ready'}
                    onClick={() => void handleOwnerDownload(job.id)}
                    isLoading={loadingAction === `download-owner-${job.id}`}
                  >
                    <Download size={14} /> Owner Download
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={job.status !== 'ready'}
                    onClick={() => void handleTokenDownload(job.id)}
                    isLoading={loadingAction === `download-token-${job.id}`}
                  >
                    <KeyRound size={14} /> Token Download
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
