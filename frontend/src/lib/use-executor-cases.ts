'use client';

import { useEffect, useState } from 'react';

import {
  apiClient,
  type CaseSummaryResponse,
  type CaseTaskResponse,
  type CaseTaskStatus,
} from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';
import { uploadWithProgress } from './upload-with-progress';

const MAX_DEATH_CERTIFICATE_BYTES = 10 * 1024 * 1024;

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
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [filters, setFilters] = useState<ExecutorTaskFilters>(INITIAL_EXECUTOR_TASK_FILTERS);

  const refreshCaseSummary = async () => {
    if (!user) {
      return null;
    }

    setIsLoadingCase(true);
    setError('');

    try {
      const summary = await apiClient.getCaseSummary({ caseId });
      setCaseSummary(summary);
      return summary;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load case summary.'));
      return null;
    } finally {
      setIsLoadingCase(false);
    }
  };

  const refreshTasks = async () => {
    if (!user) {
      return [];
    }

    setIsLoadingTasks(true);
    setError('');

    try {
      const listedTasks = await apiClient.listCaseTasks({ caseId });
      setTasks(listedTasks);
      return listedTasks;
    } catch (loadError) {
      setError(readApiErrorMessage(loadError, 'Unable to load case tasks.'));
      return [];
    } finally {
      setIsLoadingTasks(false);
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
      setError('');

      try {
        const [summary, listedTasks] = await Promise.all([
          apiClient.getCaseSummary({ caseId }),
          apiClient.listCaseTasks({ caseId }),
        ]);
        if (!active) {
          return;
        }
        setCaseSummary(summary);
        setTasks(listedTasks);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(readApiErrorMessage(loadError, 'Unable to load this case workspace.'));
      } finally {
        if (active) {
          setIsLoadingCase(false);
          setIsLoadingTasks(false);
        }
      }
    };

    void loadCase();

    return () => {
      active = false;
    };
  }, [user, caseId]);

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
      await refreshCaseSummary();
      setFeedback('Task updated.');
      return updatedTask;
    } catch (updateError) {
      setError(readApiErrorMessage(updateError, 'Unable to update this task.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  return {
    caseSummary,
    tasks,
    filters,
    isLoadingCase,
    isLoadingTasks,
    feedback,
    error,
    loadingAction,
    setFilters,
    setFeedback,
    setError,
    refreshCaseSummary,
    refreshTasks,
    updateTask,
  };
}
