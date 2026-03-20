'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';

import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { apiClient, type PacketJobResponse } from '../../../lib/api-client';
import { readApiErrorMessage } from '../../../lib/api-errors';
import { useAuth } from '../../../lib/auth-context';

const PACKET_JOBS_STORAGE_KEY = 'varasaan.packet.jobs';

function readStoredPacketJobIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PACKET_JOBS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredPacketJobIds(ids: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PACKET_JOBS_STORAGE_KEY, JSON.stringify(ids));
}

export function PacketsScreen() {
  const { user } = useAuth();
  const [platform, setPlatform] = useState('gmail');
  const [jobs, setJobs] = useState<PacketJobResponse[]>([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const hasInFlightJobs = useMemo(() => jobs.some((job) => job.status === 'queued' || job.status === 'running'), [jobs]);

  const refreshJobs = async () => {
    const ids = readStoredPacketJobIds();
    if (!ids.length) {
      setJobs([]);
      return;
    }

    const settled = await Promise.allSettled(ids.map((id) => apiClient.getPacketJob({ packetJobId: id })));
    const succeeded = settled
      .filter((result): result is PromiseFulfilledResult<PacketJobResponse> => result.status === 'fulfilled')
      .map((result) => result.value);
    setJobs(succeeded);
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshJobs().catch((refreshError) => {
      setError(readApiErrorMessage(refreshError, 'Unable to load packet jobs.'));
    });
  }, [user]);

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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('create');
    setFeedback('');
    setError('');

    try {
      const created = await apiClient.createPacketJob({
        body: {
          platform: platform.trim(),
        },
      });

      const existing = readStoredPacketJobIds();
      const nextIds = [created.id, ...existing.filter((item) => item !== created.id)];
      writeStoredPacketJobIds(nextIds);
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setFeedback('Packet generation job queued.');
    } catch (createError) {
      setError(readApiErrorMessage(createError, 'Unable to create packet job.'));
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Packets</p>
          <h2 className="dash-title">Packet Jobs</h2>
          <p className="dash-subtitle">Generate legal packet artifacts by platform.</p>
        </div>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Create Packet Job</h3>
        <form className="inventory-form" onSubmit={handleCreate}>
          <Input label="Platform" value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="e.g. gmail" required />
          <Button type="submit" isLoading={loadingAction === 'create'}>
            <FileText size={16} /> Queue Packet Job
          </Button>
        </form>
      </section>

      <section className="inventory-panel glass-panel">
        <div className="inventory-actions-row">
          <h3 className="section-title">Recent Packet Jobs</h3>
          <Button type="button" variant="ghost" onClick={() => void refreshJobs()}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>

        {jobs.length === 0 ? (
          <p className="inventory-empty">No packet jobs yet.</p>
        ) : (
          <div className="inventory-list">
            {jobs.map((job) => (
              <div key={job.id} className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">{job.platform}</div>
                  <h4>{job.id}</h4>
                  <p className="item-secondary">Packet generation pipeline</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${job.status === 'ready' ? 'success' : 'warning'}`}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
