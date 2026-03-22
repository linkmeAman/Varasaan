'use client';

import { useEffect, useState } from 'react';

import {
  apiClient,
  type CaseActivityEventResponse,
  type CaseActivationReviewStatus,
  type CaseBleedStopperResponse,
  type CaseBleedStopperRowResponse,
  type CaseReportResponse,
  type CaseSummaryResponse,
  type CaseTaskEvidenceResponse,
  type CaseTaskResponse,
  type CaseTaskStatus,
} from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';
import { sleep } from './sleep';
import { uploadWithProgress } from './upload-with-progress';

const MAX_DEATH_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024;
const PENDING_SCAN_STATUSES = new Set(['pending', 'running']);

export const EXECUTOR_TASK_STATUSES: CaseTaskStatus[] = [
  'not_started',
  'in_progress',
  'submitted',
  'waiting',
  'resolved',
  'escalated',
];
const EXECUTOR_TERMINAL_TASK_STATUSES = new Set<CaseTaskStatus>(['resolved', 'escalated']);

export type ExecutorTaskFilters = {
  status: 'all' | CaseTaskStatus;
  platform: 'all' | string;
  category: 'all' | string;
  priority: 'all' | string;
};

export type ExecutorTaskDraft = {
  notes: string;
  status: CaseTaskStatus;
  referenceNumber: string;
  submittedDate: string;
};

export const INITIAL_EXECUTOR_TASK_FILTERS: ExecutorTaskFilters = {
  status: 'all',
  platform: 'all',
  category: 'all',
  priority: 'all',
};

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function detectEvidenceContentType(file: File): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  const normalizedType = file.type.toLowerCase();
  if (normalizedType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (normalizedType === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
    return 'image/png';
  }
  if (
    normalizedType === 'image/jpeg' ||
    file.name.toLowerCase().endsWith('.jpg') ||
    file.name.toLowerCase().endsWith('.jpeg')
  ) {
    return 'image/jpeg';
  }
  return null;
}

function hasPendingEvidenceScan(rows: CaseTaskEvidenceResponse[] | undefined): boolean {
  return (rows || []).some((row) => !row.scan_status || PENDING_SCAN_STATUSES.has(row.scan_status));
}

export function getExecutorCaseLabel(caseSummary: CaseSummaryResponse): string {
  return caseSummary.owner_name || caseSummary.owner_email;
}

function getExecutorActivationReviewLabel(reviewStatus: CaseActivationReviewStatus | undefined): string {
  switch (reviewStatus) {
    case 'pending_review':
      return 'Pending review';
    case 'rejected':
      return 'Rejected review';
    case 'approved':
      return 'Approved review';
    case 'not_requested':
    default:
      return 'Activation pending';
  }
}

export function getExecutorCaseStatusLabel(caseSummary: CaseSummaryResponse): string {
  if (caseSummary.status === 'activation_pending') {
    return getExecutorActivationReviewLabel(caseSummary.activation_review_status);
  }
  return getExecutorStatusLabel(caseSummary.status);
}

export function getExecutorCaseStatusTone(caseSummary: CaseSummaryResponse): string {
  if (caseSummary.status !== 'activation_pending') {
    return `executor-status-${caseSummary.status}`;
  }
  switch (caseSummary.activation_review_status) {
    case 'pending_review':
      return 'executor-status-pending_review';
    case 'rejected':
      return 'executor-status-rejected_review';
    default:
      return 'executor-status-activation_pending';
  }
}

export function canExecutorUploadDeathCertificate(caseSummary: CaseSummaryResponse): boolean {
  return caseSummary.status === 'activation_pending' && caseSummary.activation_review_status !== 'pending_review';
}

export function formatExecutorReviewReason(reason: string | null | undefined): string {
  if (!reason) {
    return 'Not provided';
  }
  return reason.replaceAll('_', ' ');
}

export function getExecutorActivationDescription(caseSummary: CaseSummaryResponse): string {
  if (caseSummary.status === 'closed') {
    return `This case is closed. Evidence is retained until ${
      caseSummary.evidence_retention_expires_at ? formatExecutorDate(caseSummary.evidence_retention_expires_at) : 'the retention window ends'
    }.`;
  }
  switch (caseSummary.activation_review_status) {
    case 'pending_review':
      return 'The uploaded death certificate is awaiting manual review. The executor workspace unlocks after approval.';
    case 'rejected':
      return 'The last uploaded death certificate was rejected during manual review. Upload a replacement PDF to continue activation.';
    default:
      return 'Upload a PDF death certificate to unlock the executor workspace for this case.';
  }
}

export function getExecutorStatusLabel(status: CaseSummaryResponse['status'] | CaseTaskStatus): string {
  switch (status) {
    case 'activation_pending':
      return 'Activation pending';
    case 'active':
      return 'Active';
    case 'closed':
      return 'Closed';
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'waiting':
      return 'Waiting';
    case 'resolved':
      return 'Resolved';
    case 'escalated':
      return 'Escalated';
    default:
      return status;
  }
}

export function getExecutorEvidenceStatusLabel(evidence: CaseTaskEvidenceResponse): string {
  switch (evidence.scan_status) {
    case 'clean':
      return 'Scan passed';
    case 'infected':
      return 'Scan failed';
    case 'error':
      return 'Scan error';
    case 'running':
      return 'Scanning';
    case 'pending':
      return 'Pending scan';
    default:
      return evidence.document_state.replaceAll('_', ' ');
  }
}

export function isExecutorTaskTerminal(status: CaseTaskStatus): boolean {
  return EXECUTOR_TERMINAL_TASK_STATUSES.has(status);
}

export function getExecutorBleedStopperActionLabel(actionType: CaseBleedStopperRowResponse['action_type']): string {
  switch (actionType) {
    case 'card_dispute':
      return 'Cancel card mandate and dispute debits';
    case 'revoke_upi_autopay':
      return 'Revoke UPI autopay mandate';
    case 'cancel_recurring_payment':
      return 'Cancel recurring payment';
    default:
      return actionType;
  }
}

export function formatExecutorTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatExecutorDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function useExecutorCases() {
  const { user } = useAuth();

  const [cases, setCases] = useState<CaseSummaryResponse[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const refreshCases = async () => {
    if (!user) {
      return [];
    }

    setIsLoadingCases(true);
    setError('');

    try {
      const listedCases = await apiClient.listAccessibleCases();
      setCases(listedCases);
      return listedCases;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load executor cases.'));
      return [];
    } finally {
      setIsLoadingCases(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const loadCases = async () => {
      setIsLoadingCases(true);
      setError('');

      try {
        const listedCases = await apiClient.listAccessibleCases();
        if (!active) {
          return;
        }
        setCases(listedCases);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(readApiErrorMessage(loadError, 'Unable to load executor cases.'));
      } finally {
        if (active) {
          setIsLoadingCases(false);
        }
      }
    };

    void loadCases();

    return () => {
      active = false;
    };
  }, [user]);

  const activateCaseWithDeathCertificate = async (caseId: string, file: File) => {
    if (!isPdfFile(file)) {
      setError('Death certificate must be a PDF.');
      return null;
    }

    if (file.size > MAX_DEATH_CERTIFICATE_BYTES) {
      setError('Death certificate must be 10MB or smaller.');
      return null;
    }

    setLoadingAction(`activate-${caseId}`);
    setError('');
    setFeedback('');
    setUploadProgress(0);

    try {
      const init = await apiClient.initCaseDeathCertificateUpload({
        caseId,
        body: {
          size_bytes: file.size,
          content_type: 'application/pdf',
          sha256: null,
        },
      });

      await uploadWithProgress({
        url: init.upload_url,
        file,
        contentType: 'application/pdf',
        onProgress: setUploadProgress,
      });

      const activatedCase = await apiClient.activateCase({
        caseId,
        body: {
          document_id: init.document_id,
          version_id: init.version_id,
        },
      });

      await refreshCases();
      if (activatedCase.status === 'active') {
        setFeedback('Case activated and tasks generated.');
      } else if (activatedCase.activation_review_status === 'pending_review') {
        setFeedback('Death certificate uploaded. Manual review is now pending.');
      } else if (activatedCase.activation_review_status === 'rejected') {
        setFeedback('The last uploaded certificate is still rejected. Upload a replacement PDF to continue.');
      } else {
        setFeedback('Death certificate uploaded.');
      }
      return activatedCase;
    } catch (activationError) {
      setError(readApiErrorMessage(activationError, 'Unable to activate this case.'));
      return null;
    } finally {
      setLoadingAction('');
      setUploadProgress(0);
    }
  };

  return {
    cases,
    isLoadingCases,
    feedback,
    error,
    loadingAction,
    uploadProgress,
    refreshCases,
    activateCaseWithDeathCertificate,
    setFeedback,
    setError,
  };
}

export function useExecutorCase(caseId: string) {
  const { user } = useAuth();

  const [caseSummary, setCaseSummary] = useState<CaseSummaryResponse | null>(null);
  const [tasks, setTasks] = useState<CaseTaskResponse[]>([]);
  const [activity, setActivity] = useState<CaseActivityEventResponse[]>([]);
  const [bleedStopper, setBleedStopper] = useState<CaseBleedStopperResponse | null>(null);
  const [evidenceByTask, setEvidenceByTask] = useState<Record<string, CaseTaskEvidenceResponse[]>>({});
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingBleedStopper, setIsLoadingBleedStopper] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filters, setFilters] = useState<ExecutorTaskFilters>(INITIAL_EXECUTOR_TASK_FILTERS);

  const refreshCaseSummary = async (options?: { background?: boolean }) => {
    if (!user) {
      return null;
    }

    if (!options?.background) {
      setIsLoadingCase(true);
      setError('');
    }

    try {
      const summary = await apiClient.getCaseSummary({ caseId });
      setCaseSummary(summary);
      return summary;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load case summary.'));
      return null;
    } finally {
      if (!options?.background) {
        setIsLoadingCase(false);
      }
    }
  };

  const refreshTasks = async (options?: { background?: boolean }) => {
    if (!user) {
      return [];
    }

    if (!options?.background) {
      setIsLoadingTasks(true);
      setError('');
    }

    try {
      const listedTasks = await apiClient.listCaseTasks({ caseId });
      setTasks(listedTasks);
      return listedTasks;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load case tasks.'));
      return [];
    } finally {
      if (!options?.background) {
        setIsLoadingTasks(false);
      }
    }
  };

  const refreshActivity = async (options?: { background?: boolean }) => {
    if (!user) {
      return [];
    }

    if (!options?.background) {
      setIsLoadingActivity(true);
      setError('');
    }

    try {
      const events = await apiClient.getCaseActivity({ caseId });
      setActivity(events);
      return events;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load case activity.'));
      return [];
    } finally {
      if (!options?.background) {
        setIsLoadingActivity(false);
      }
    }
  };

  const refreshEvidence = async (taskId: string) => {
    if (!user) {
      return [];
    }

    try {
      const rows = await apiClient.listCaseTaskEvidence({ caseId, taskId });
      setEvidenceByTask((current) => ({ ...current, [taskId]: rows }));
      return rows;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load task evidence.'));
      return [];
    }
  };

  const refreshBleedStopper = async (options?: { background?: boolean }) => {
    if (!user) {
      return null;
    }

    if (!options?.background) {
      setIsLoadingBleedStopper(true);
      setError('');
    }

    try {
      const summary = caseSummary ?? (await apiClient.getCaseSummary({ caseId }));
      if (summary.status !== 'active') {
        setBleedStopper(null);
        return null;
      }

      const nextBleedStopper = await apiClient.getCaseBleedStopper({ caseId });
      setBleedStopper(nextBleedStopper);
      return nextBleedStopper;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load the subscription bleed stopper.'));
      return null;
    } finally {
      if (!options?.background) {
        setIsLoadingBleedStopper(false);
      }
    }
  };

  useEffect(() => {
    if (!user || !caseId) {
      return;
    }

    let active = true;

    const loadCase = async () => {
      setIsLoadingCase(true);
      setIsLoadingTasks(true);
      setIsLoadingActivity(true);
      setIsLoadingBleedStopper(true);
      setError('');

      try {
        const [summary, listedTasks, events] = await Promise.all([
          apiClient.getCaseSummary({ caseId }),
          apiClient.listCaseTasks({ caseId }),
          apiClient.getCaseActivity({ caseId }),
        ]);
        const nextBleedStopper = summary.status === 'active' ? await apiClient.getCaseBleedStopper({ caseId }) : null;
        if (!active) {
          return;
        }
        setCaseSummary(summary);
        setTasks(listedTasks);
        setActivity(events);
        setBleedStopper(nextBleedStopper);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(readApiErrorMessage(loadError, 'Unable to load this case workspace.'));
      } finally {
        if (active) {
          setIsLoadingCase(false);
          setIsLoadingTasks(false);
          setIsLoadingActivity(false);
          setIsLoadingBleedStopper(false);
        }
      }
    };

    void loadCase();

    return () => {
      active = false;
    };
  }, [user, caseId]);

  useEffect(() => {
    if (!user || !caseId) {
      return;
    }

    const pendingTaskIds = Object.entries(evidenceByTask)
      .filter(([, rows]) => hasPendingEvidenceScan(rows))
      .map(([taskId]) => taskId);
    if (pendingTaskIds.length === 0) {
      return;
    }

    const pollPendingEvidence = async () => {
      try {
        const [summary, listedTasks, events] = await Promise.all([
          apiClient.getCaseSummary({ caseId }),
          apiClient.listCaseTasks({ caseId }),
          apiClient.getCaseActivity({ caseId }),
        ]);
        setCaseSummary(summary);
        setTasks(listedTasks);
        setActivity(events);

        const evidenceResults = await Promise.all(
          pendingTaskIds.map(async (taskId) => ({
            taskId,
            rows: await apiClient.listCaseTaskEvidence({ caseId, taskId }),
          })),
        );
        setEvidenceByTask((current) => {
          const nextState = { ...current };
          for (const result of evidenceResults) {
            nextState[result.taskId] = result.rows;
          }
          return nextState;
        });
      } catch (pollError) {
        setError(readApiErrorMessage(pollError, 'Unable to refresh pending evidence scans.'));
      }
    };

    const interval = window.setInterval(() => {
      void pollPendingEvidence();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [user, caseId, evidenceByTask]);

  const updateTask = async (taskId: string, draft: ExecutorTaskDraft) => {
    setLoadingAction(`task-${taskId}`);
    setError('');
    setFeedback('');

    try {
      const updatedTask = await apiClient.patchCaseTask({
        caseId,
        taskId,
        body: {
          notes: draft.notes.trim() || null,
          status: draft.status,
          reference_number: draft.referenceNumber.trim() || null,
          submitted_date: draft.submittedDate || null,
        },
      });

      setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)));
      await Promise.all([
        refreshCaseSummary({ background: true }),
        refreshActivity({ background: true }),
        refreshBleedStopper({ background: true }),
      ]);
      setFeedback('Task updated.');
      return updatedTask;
    } catch (updateError) {
      setError(readApiErrorMessage(updateError, 'Unable to update this task.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const uploadTaskEvidence = async (taskId: string, file: File) => {
    const contentType = detectEvidenceContentType(file);
    if (!contentType) {
      setError('Evidence must be a PDF, PNG, or JPEG.');
      return null;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      setError('Evidence must be 50MB or smaller.');
      return null;
    }

    setLoadingAction(`evidence-upload-${taskId}`);
    setError('');
    setFeedback('');
    setUploadProgress(0);

    try {
      const init = await apiClient.initCaseTaskEvidenceUpload({
        caseId,
        taskId,
        body: {
          file_name: file.name,
          size_bytes: file.size,
          content_type: contentType,
          sha256: null,
        },
      });

      await uploadWithProgress({
        url: init.upload_url,
        file,
        contentType,
        onProgress: setUploadProgress,
      });

      await apiClient.queueCaseTaskEvidenceScan({
        caseId,
        taskId,
        evidenceId: init.evidence_id,
      });

      let latestEvidence = await refreshEvidence(taskId);
      await Promise.all([
        refreshCaseSummary({ background: true }),
        refreshTasks({ background: true }),
        refreshActivity({ background: true }),
      ]);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const matching = latestEvidence.find((row) => row.id === init.evidence_id);
        if (matching && matching.scan_status && !PENDING_SCAN_STATUSES.has(matching.scan_status)) {
          break;
        }
        await sleep(2000);
        latestEvidence = await refreshEvidence(taskId);
      }

      await Promise.all([
        refreshCaseSummary({ background: true }),
        refreshTasks({ background: true }),
        refreshActivity({ background: true }),
      ]);
      const completed = latestEvidence.find((row) => row.id === init.evidence_id);
      if (completed?.scan_status === 'clean') {
        setFeedback('Evidence uploaded and scan passed.');
      } else if (completed?.scan_status) {
        setFeedback(`Evidence uploaded. Current scan status: ${completed.scan_status}.`);
      } else {
        setFeedback('Evidence uploaded and scan queued.');
      }
      return completed || null;
    } catch (uploadError) {
      setError(readApiErrorMessage(uploadError, 'Unable to upload task evidence.'));
      return null;
    } finally {
      setLoadingAction('');
      setUploadProgress(0);
    }
  };

  const downloadTaskEvidence = async (taskId: string, evidenceId: string) => {
    setLoadingAction(`evidence-download-${evidenceId}`);
    setError('');

    try {
      const response = await apiClient.getCaseTaskEvidenceDownload({ caseId, taskId, evidenceId });
      window.open(response.download_url, '_blank', 'noopener,noreferrer');
      return response;
    } catch (downloadError) {
      setError(readApiErrorMessage(downloadError, 'Unable to download this evidence file.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  return {
    caseSummary,
    tasks,
    activity,
    bleedStopper,
    evidenceByTask,
    filters,
    isLoadingCase,
    isLoadingTasks,
    isLoadingActivity,
    isLoadingBleedStopper,
    feedback,
    error,
    loadingAction,
    uploadProgress,
    setFilters,
    setFeedback,
    setError,
    refreshCaseSummary,
    refreshTasks,
    refreshActivity,
    refreshBleedStopper,
    refreshEvidence,
    updateTask,
    uploadTaskEvidence,
    downloadTaskEvidence,
  };
}

export function useExecutorCaseBleedStopper(caseId: string) {
  const { user } = useAuth();

  const [bleedStopper, setBleedStopper] = useState<CaseBleedStopperResponse | null>(null);
  const [isLoadingBleedStopper, setIsLoadingBleedStopper] = useState(true);
  const [error, setError] = useState('');

  const refreshBleedStopper = async () => {
    if (!user) {
      return null;
    }

    setIsLoadingBleedStopper(true);
    setError('');

    try {
      const nextBleedStopper = await apiClient.getCaseBleedStopper({ caseId });
      setBleedStopper(nextBleedStopper);
      return nextBleedStopper;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load the subscription bleed stopper.'));
      return null;
    } finally {
      setIsLoadingBleedStopper(false);
    }
  };

  useEffect(() => {
    if (!user || !caseId) {
      return;
    }

    let active = true;

    const loadBleedStopper = async () => {
      setIsLoadingBleedStopper(true);
      setError('');

      try {
        const nextBleedStopper = await apiClient.getCaseBleedStopper({ caseId });
        if (!active) {
          return;
        }
        setBleedStopper(nextBleedStopper);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(readApiErrorMessage(loadError, 'Unable to load the subscription bleed stopper.'));
      } finally {
        if (active) {
          setIsLoadingBleedStopper(false);
        }
      }
    };

    void loadBleedStopper();

    return () => {
      active = false;
    };
  }, [user, caseId]);

  return {
    bleedStopper,
    isLoadingBleedStopper,
    error,
    refreshBleedStopper,
  };
}

export function useExecutorCaseReport(caseId: string) {
  const { user } = useAuth();

  const [report, setReport] = useState<CaseReportResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const refreshReport = async () => {
    if (!user) {
      return null;
    }

    setIsLoadingReport(true);
    setError('');

    try {
      const nextReport = await apiClient.getCaseReport({ caseId });
      setReport(nextReport);
      return nextReport;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load the closure report.'));
      return null;
    } finally {
      setIsLoadingReport(false);
    }
  };

  useEffect(() => {
    if (!user || !caseId) {
      return;
    }

    let active = true;

    const loadReport = async () => {
      setIsLoadingReport(true);
      setError('');

      try {
        const nextReport = await apiClient.getCaseReport({ caseId });
        if (!active) {
          return;
        }
        setReport(nextReport);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(readApiErrorMessage(loadError, 'Unable to load the closure report.'));
      } finally {
        if (active) {
          setIsLoadingReport(false);
        }
      }
    };

    void loadReport();

    return () => {
      active = false;
    };
  }, [user, caseId]);

  const closeCase = async () => {
    if (!user) {
      return null;
    }

    if (report?.summary.status === 'closed') {
      return report;
    }

    setLoadingAction('close-case');
    setError('');
    setFeedback('');

    try {
      await apiClient.closeCase({ caseId });
      const nextReport = await apiClient.getCaseReport({ caseId });
      setReport(nextReport);
      setFeedback('Case closed and evidence retention scheduled.');
      return nextReport;
    } catch (closeError) {
      setError(readApiErrorMessage(closeError, 'Unable to close this case.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  return {
    report,
    isLoadingReport,
    error,
    feedback,
    loadingAction,
    refreshReport,
    closeCase,
  };
}
