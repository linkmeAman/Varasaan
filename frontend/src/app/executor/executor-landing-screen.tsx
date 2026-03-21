'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileUp, FolderKanban, ShieldAlert } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import {
  getExecutorCaseLabel,
  getExecutorStatusLabel,
  useExecutorCases,
} from '../../lib/use-executor-cases';

export function ExecutorLandingScreen() {
  const router = useRouter();
  const {
    cases,
    isLoadingCases,
    feedback,
    error,
    loadingAction,
    uploadProgress,
    activateCaseWithDeathCertificate,
    setError,
  } = useExecutorCases();
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const preferredCaseId =
    selectedCaseId && cases.some((caseSummary) => caseSummary.id === selectedCaseId)
      ? selectedCaseId
      : (cases.find((caseSummary) => caseSummary.status === 'activation_pending') || cases[0])?.id || '';
  const selectedCase = cases.find((caseSummary) => caseSummary.id === preferredCaseId) || null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError('');
  };

  const handleActivate = async () => {
    if (!selectedCase) {
      return;
    }

    if (!selectedFile) {
      setError('Select a death certificate PDF to continue.');
      return;
    }

    const activatedCase = await activateCaseWithDeathCertificate(selectedCase.id, selectedFile);
    if (activatedCase) {
      router.push(`/executor/cases/${activatedCase.id}`);
    }
  };

  return (
    <div className="executor-container animate-fade-in">
      <header className="executor-header glass-panel">
        <div className="executor-header-content">
          <div className="status-badge live">After-Loss</div>
          <h1 className="executor-title">Executor Cases</h1>
          <p className="executor-subtitle">
            Pending cases stay locked until a death certificate is uploaded and validated. Active cases open directly into the task workspace.
          </p>
        </div>
      </header>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Cases</p>
            <h2 className="section-title">Accessible Cases</h2>
          </div>
        </div>

        {isLoadingCases ? (
          <p className="inventory-empty">Loading accessible cases...</p>
        ) : cases.length === 0 ? (
          <div className="executor-empty-state">
            <ShieldAlert size={20} />
            <p>No accepted executor cases are available for this account.</p>
          </div>
        ) : (
          <div className="executor-case-list">
            {cases.map((caseSummary) => (
              <button
                key={caseSummary.id}
                type="button"
                className={`executor-case-card glass-panel ${preferredCaseId === caseSummary.id ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedCaseId(caseSummary.id);
                  setSelectedFile(null);
                }}
              >
                <div className="executor-case-card-header">
                  <span className={`status-indicator executor-status-${caseSummary.status}`}>{getExecutorStatusLabel(caseSummary.status)}</span>
                  <span className="item-badge">{caseSummary.task_count} tasks</span>
                </div>
                <h3>{getExecutorCaseLabel(caseSummary)}</h3>
                <p className="item-secondary">{caseSummary.owner_email}</p>
                <div className="executor-case-card-meta">
                  <span>Not started: {caseSummary.task_status_counts.not_started}</span>
                  <span>Resolved: {caseSummary.task_status_counts.resolved}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCase ? (
        selectedCase.status === 'activation_pending' ? (
          <section className="inventory-panel glass-panel executor-section">
            <div className="executor-section-header">
              <div>
                <p className="item-badge">Activation</p>
                <h2 className="section-title">Activate {getExecutorCaseLabel(selectedCase)}</h2>
                <p className="dash-subtitle">Upload a PDF death certificate to unlock the executor workspace for this case.</p>
              </div>
            </div>

            <div className="executor-activation-grid">
              <div className="executor-activation-copy">
                <div className="heartbeat-warning">
                  <ShieldAlert size={18} />
                  <p>Activation requires a single PDF under 10MB. The upload is stored under the deceased owner&apos;s secure document record.</p>
                </div>
                <div className="executor-activation-meta">
                  <span>Owner</span>
                  <strong>{selectedCase.owner_email}</strong>
                </div>
              </div>

              <div className="inventory-form">
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="death-certificate-file">
                    Death Certificate PDF <span className="input-required">*</span>
                  </label>
                  <input
                    id="death-certificate-file"
                    className="input-field"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                  />
                </div>

                {loadingAction === `activate-${selectedCase.id}` ? (
                  <div className="upload-progress">
                    <div className="upload-progress-bar">
                      <span style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="input-helper-msg">Uploading {uploadProgress}%</p>
                  </div>
                ) : null}

                <Button type="button" onClick={() => void handleActivate()} isLoading={loadingAction === `activate-${selectedCase.id}`}>
                  <FileUp size={16} /> Upload and Activate
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="inventory-panel glass-panel executor-section">
            <div className="executor-section-header">
              <div>
                <p className="item-badge">Workspace</p>
                <h2 className="section-title">{getExecutorCaseLabel(selectedCase)}</h2>
                <p className="dash-subtitle">This case is active. Open the workspace to manage the generated task board and list view.</p>
              </div>
            </div>

            <div className="executor-active-actions">
              <div className="executor-active-summary">
                <span>Tasks: {selectedCase.task_count}</span>
                <span>In progress: {selectedCase.task_status_counts.in_progress}</span>
                <span>Waiting: {selectedCase.task_status_counts.waiting}</span>
              </div>

              <Button type="button" variant="secondary" onClick={() => router.push(`/executor/cases/${selectedCase.id}`)}>
                <FolderKanban size={16} /> Open Workspace <ArrowRight size={16} />
              </Button>
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}
