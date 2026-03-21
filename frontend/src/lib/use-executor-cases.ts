'use client';

import { useEffect, useState } from 'react';

import {
  apiClient,
  type CaseActivityEventResponse,
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
      setFeedback('Case activated and tasks generated.');
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
  const [evidenceByTask, setEvidenceByTask] = useState<Record<string, CaseTaskEvidenceResponse[]>>({});
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
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

  useEffect(() => {
    if (!user || !caseId) {
      return;
    }

    let active = true;

    const loadCase = async () => {
      setIsLoadingCase(true);
      setIsLoadingTasks(true);
      setIsLoadingActivity(true);
      setError('');

      try {
        const [summary, listedTasks, events] = await Promise.all([
          apiClient.getCaseSummary({ caseId }),
          apiClient.listCaseTasks({ caseId }),
          apiClient.getCaseActivity({ caseId }),
        ]);
        if (!active) {
          return;
        }
        setCaseSummary(summary);
        setTasks(listedTasks);
        setActivity(events);
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
      await Promise.all([refreshCaseSummary({ background: true }), refreshActivity({ background: true })]);
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
    evidenceByTask,
    filters,
    isLoadingCase,
    isLoadingTasks,
    isLoadingActivity,
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
    refreshEvidence,
    updateTask,
    uploadTaskEvidence,
    downloadTaskEvidence,
  };
}

export function useExecutorCaseReport(caseId: string) {
  const { user } = useAuth();

  const [report, setReport] = useState<CaseReportResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [error, setError] = useState('');

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

  return {
    report,
    isLoadingReport,
    error,
    refreshReport,
  };
}
