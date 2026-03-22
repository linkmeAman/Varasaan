'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Download, FileUp, PencilLine, Printer, RotateCcw } from 'lucide-react';

import { Dialog } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { type CaseTaskResponse } from '../../../../lib/api-client';
import { formatInrFromPaise, formatPaymentRailLabel } from '../../../../lib/utils';
import {
  EXECUTOR_TASK_STATUSES,
  INITIAL_EXECUTOR_TASK_FILTERS,
  formatExecutorDate,
  formatExecutorTimestamp,
  getExecutorBleedStopperActionLabel,
  getExecutorCaseLabel,
  getExecutorEvidenceStatusLabel,
  getExecutorStatusLabel,
  isExecutorTaskTerminal,
  type ExecutorTaskDraft,
  useExecutorCase,
} from '../../../../lib/use-executor-cases';

type ExecutorCaseWorkspaceScreenProps = {
  caseId: string;
};

function createTaskDraft(task: CaseTaskResponse): ExecutorTaskDraft {
  return {
    notes: task.notes || '',
    status: task.status,
    referenceNumber: task.reference_number || '',
    submittedDate: task.submitted_date || '',
  };
}

export function ExecutorCaseWorkspaceScreen({ caseId }: ExecutorCaseWorkspaceScreenProps) {
  const router = useRouter();
  const {
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
    updateTask,
    refreshEvidence,
    uploadTaskEvidence,
    downloadTaskEvidence,
  } = useExecutorCase(caseId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExecutorTaskDraft | null>(null);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<File | null>(null);
  const [evidenceInputKey, setEvidenceInputKey] = useState(0);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null;
  const selectedTaskEvidence = selectedTask ? evidenceByTask[selectedTask.id] : undefined;

  const platformOptions = Array.from(new Set(tasks.map((task) => task.platform))).sort();
  const categoryOptions = Array.from(new Set(tasks.map((task) => task.category))).sort();
  const priorityOptions = Array.from(new Set(tasks.map((task) => String(task.priority)))).sort((left, right) => Number(right) - Number(left));

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filters.status !== 'all' && task.status !== filters.status) {
          return false;
        }
        if (filters.platform !== 'all' && task.platform !== filters.platform) {
          return false;
        }
        if (filters.category !== 'all' && task.category !== filters.category) {
          return false;
        }
        if (filters.priority !== 'all' && String(task.priority) !== filters.priority) {
          return false;
        }
        return true;
      }),
    [filters, tasks],
  );
  const recurringTasksRequiringActionCount = useMemo(
    () => bleedStopper?.rows.filter((row) => !isExecutorTaskTerminal(row.status)).length || 0,
    [bleedStopper],
  );
  const recurringActionRows = useMemo(
    () => (bleedStopper?.rows || []).filter((row) => !isExecutorTaskTerminal(row.status)).slice(0, 4),
    [bleedStopper],
  );

  const openTaskEditor = (task: CaseTaskResponse) => {
    setSelectedTaskId(task.id);
    setDraft(createTaskDraft(task));
    setSelectedEvidenceFile(null);
    setEvidenceInputKey((current) => current + 1);
    void refreshEvidence(task.id);
  };

  const closeTaskEditor = () => {
    setSelectedTaskId(null);
    setDraft(null);
    setSelectedEvidenceFile(null);
    setEvidenceInputKey((current) => current + 1);
  };

  const handleSave = async () => {
    if (!selectedTask || !draft) {
      return;
    }

    const updatedTask = await updateTask(selectedTask.id, draft);
    if (updatedTask) {
      setDraft(createTaskDraft(updatedTask));
    }
  };

  const handleEvidenceUpload = async () => {
    if (!selectedTask || !selectedEvidenceFile) {
      return;
    }

    const uploaded = await uploadTaskEvidence(selectedTask.id, selectedEvidenceFile);
    if (uploaded) {
      setSelectedEvidenceFile(null);
      setEvidenceInputKey((current) => current + 1);
    }
  };

  if (isLoadingCase) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="inventory-empty">Loading case workspace...</p>
        </section>
      </div>
    );
  }

  if (!caseSummary) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="input-error-msg">{error || 'Unable to load this case.'}</p>
        </section>
      </div>
    );
  }

  if (caseSummary.status !== 'active') {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel executor-section">
          <div className="executor-section-header">
            <div>
              <p className="item-badge">{caseSummary.status === 'closed' ? 'Closed' : 'Activation'}</p>
              <h1 className="section-title">{getExecutorCaseLabel(caseSummary)}</h1>
              <p className="dash-subtitle">
                {caseSummary.status === 'closed'
                  ? `This case is closed. Evidence is retained until ${caseSummary.evidence_retention_expires_at ? formatExecutorDate(caseSummary.evidence_retention_expires_at) : 'the retention window ends'}.`
                  : 'This case is still pending activation. Return to the executor landing page to upload the death certificate.'}
              </p>
            </div>
          </div>
          <div className="inventory-actions-row">
            <Button type="button" variant="secondary" onClick={() => router.push('/executor')}>
              <ArrowLeft size={16} /> Back to Cases
            </Button>
            {caseSummary.status === 'closed' ? (
              <Button type="button" onClick={() => router.push(`/executor/cases/${caseId}/report`)}>
                <Printer size={16} /> View Closure Report
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="executor-container animate-fade-in">
      <header className="executor-header glass-panel executor-workspace-header">
        <div className="executor-header-content">
          <div className="status-badge live">Active case</div>
          <h1 className="executor-title">{getExecutorCaseLabel(caseSummary)}</h1>
          <p className="executor-subtitle">{caseSummary.owner_email}</p>
        </div>

        <div className="executor-active-summary">
          <span>Total tasks: {caseSummary.task_count}</span>
          <span>In progress: {caseSummary.task_status_counts.in_progress}</span>
          <span>Waiting: {caseSummary.task_status_counts.waiting}</span>
          <span>Resolved: {caseSummary.task_status_counts.resolved}</span>
        </div>

        <div className="executor-workspace-actions">
          <Button type="button" variant="ghost" onClick={() => router.push('/executor')}>
            <ArrowLeft size={16} /> Back to Cases
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(`/executor/cases/${caseId}/bleed-stopper`)}>
            <AlertCircle size={16} /> Subscription Bleed Stopper
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(`/executor/cases/${caseId}/report`)}>
            <Printer size={16} /> Closure Report
          </Button>
        </div>
      </header>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel executor-section bleed-stopper-panel">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Bleed Stopper</p>
            <h2 className="section-title">Subscription Bleed Stopper</h2>
            <p className="dash-subtitle">Recurring payment snapshots from planning mode are frozen into this case at activation.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => router.push(`/executor/cases/${caseId}/bleed-stopper`)}>
            <Printer size={16} /> Open Printable Checklist
          </Button>
        </div>

        {isLoadingBleedStopper ? (
          <p className="inventory-empty">Loading recurring payment checklist...</p>
        ) : !bleedStopper || bleedStopper.recurring_task_count === 0 ? (
          <p className="inventory-empty">No recurring subscriptions were captured in planning mode for this case.</p>
        ) : (
          <>
            <div className="bleed-stopper-summary-grid">
              <div className="report-summary-card">
                <span>Estimated monthly bleed</span>
                <strong>{formatInrFromPaise(bleedStopper.monthly_bleed_paise)}</strong>
              </div>
              <div className="report-summary-card">
                <span>Recurring tasks</span>
                <strong>{bleedStopper.recurring_task_count}</strong>
              </div>
              <div className="report-summary-card">
                <span>Requiring action</span>
                <strong>{recurringTasksRequiringActionCount}</strong>
              </div>
            </div>

            <div className="bleed-stopper-preview-list">
              {(recurringActionRows.length > 0 ? recurringActionRows : bleedStopper.rows.slice(0, 4)).map((row) => (
                <div key={row.task_id} className="bleed-stopper-preview-item">
                  <div>
                    <strong>{row.platform}</strong>
                    <p className="item-secondary">
                      {row.category} • {formatPaymentRailLabel(row.payment_rail)} • {formatInrFromPaise(row.monthly_amount_paise)} / month
                    </p>
                    <p className="item-secondary">{getExecutorBleedStopperActionLabel(row.action_type)}</p>
                  </div>
                  <span className={`status-indicator ${isExecutorTaskTerminal(row.status) ? 'success' : 'warning'}`}>
                    {getExecutorStatusLabel(row.status)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog
        open={Boolean(selectedTask && draft)}
        onOpenChange={(open) => {
          if (!open) {
            closeTaskEditor();
          }
        }}
        title={selectedTask ? `${selectedTask.platform} task` : 'Task details'}
        description={selectedTask ? `${selectedTask.category} • Priority ${selectedTask.priority}` : undefined}
      >
        {selectedTask && draft ? (
          <div className="inventory-form">
            <div className="executor-task-readonly">
              <div>
                <span>Platform</span>
                <strong>{selectedTask.platform}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{selectedTask.category}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{selectedTask.priority}</strong>
              </div>
              {selectedTask.is_recurring_payment ? (
                <>
                  <div>
                    <span>Recurring payment</span>
                    <strong>{formatInrFromPaise(selectedTask.monthly_amount_paise)} / month</strong>
                  </div>
                  <div>
                    <span>Payment rail</span>
                    <strong>{formatPaymentRailLabel(selectedTask.payment_rail)}</strong>
                  </div>
                  <div>
                    <span>Reference hint</span>
                    <strong>{selectedTask.payment_reference_hint || 'Not provided'}</strong>
                  </div>
                </>
              ) : null}
            </div>

            <label className="input-label" htmlFor="task-status">
              Status <span className="input-required">*</span>
            </label>
            <select
              id="task-status"
              className="input-field"
              value={draft.status}
              onChange={(event) => setDraft((current) => (current ? { ...current, status: event.target.value as ExecutorTaskDraft['status'] } : current))}
            >
              {EXECUTOR_TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getExecutorStatusLabel(status)}
                </option>
              ))}
            </select>

            <Input
              label="Reference Number"
              value={draft.referenceNumber}
              onChange={(event) => setDraft((current) => (current ? { ...current, referenceNumber: event.target.value } : current))}
            />

            <Input
              label="Submitted Date"
              type="date"
              value={draft.submittedDate}
              onChange={(event) => setDraft((current) => (current ? { ...current, submittedDate: event.target.value } : current))}
            />

            <div className="input-wrapper">
              <label className="input-label" htmlFor="task-notes">
                Notes
              </label>
              <textarea
                id="task-notes"
                className="input-field executor-textarea"
                value={draft.notes}
                onChange={(event) => setDraft((current) => (current ? { ...current, notes: event.target.value } : current))}
              />
            </div>

            <section className="executor-evidence-section">
              <div className="executor-section-header">
                <div>
                  <p className="item-badge">Evidence</p>
                  <h3 className="section-title">Proof Files</h3>
                  <p className="dash-subtitle">Upload PDFs, PNGs, or JPEGs. Each file is scanned before it can appear in the closure report.</p>
                </div>
              </div>

              <div className="executor-evidence-upload">
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="task-evidence-file">
                    Evidence File
                  </label>
                  <input
                    key={evidenceInputKey}
                    id="task-evidence-file"
                    className="input-field"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                    onChange={(event) => setSelectedEvidenceFile(event.target.files?.[0] ?? null)}
                  />
                </div>

                {loadingAction === `evidence-upload-${selectedTask.id}` ? (
                  <div className="upload-progress">
                    <div className="upload-progress-bar">
                      <span style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="input-helper-msg">Uploading {uploadProgress}%</p>
                  </div>
                ) : null}

                <Button
                  type="button"
                  onClick={() => void handleEvidenceUpload()}
                  isLoading={loadingAction === `evidence-upload-${selectedTask.id}`}
                  disabled={!selectedEvidenceFile}
                >
                  <FileUp size={16} /> Upload Evidence
                </Button>
              </div>

              {selectedTaskEvidence === undefined ? (
                <p className="inventory-empty">Loading task evidence...</p>
              ) : selectedTaskEvidence.length === 0 ? (
                <p className="inventory-empty">No evidence uploaded for this task yet.</p>
              ) : (
                <div className="executor-evidence-list">
                  {selectedTaskEvidence.map((evidence) => (
                    <div key={evidence.id} className="executor-evidence-item glass-panel">
                      <div className="item-meta">
                        <div className="executor-evidence-item-header">
                          <strong>{evidence.file_name}</strong>
                          <span className={`status-indicator ${evidence.scan_status === 'clean' ? 'success' : 'warning'}`}>
                            {getExecutorEvidenceStatusLabel(evidence)}
                          </span>
                        </div>
                        <p className="item-secondary">{evidence.content_type}</p>
                        <p className="item-secondary">Uploaded: {formatExecutorTimestamp(evidence.created_at)}</p>
                        {evidence.scan_summary ? <p className="item-secondary">{evidence.scan_summary}</p> : null}
                      </div>
                      <div className="inventory-item-actions">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void downloadTaskEvidence(selectedTask.id, evidence.id)}
                          disabled={!evidence.download_available}
                          isLoading={loadingAction === `evidence-download-${evidence.id}`}
                        >
                          <Download size={14} /> Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="inventory-actions-row">
              <Button type="button" onClick={() => void handleSave()} isLoading={loadingAction === `task-${selectedTask.id}`}>
                <PencilLine size={16} /> Save Task
              </Button>
              <Button type="button" variant="ghost" onClick={closeTaskEditor}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Filters</p>
            <h2 className="section-title">Task Filters</h2>
          </div>
          <Button type="button" variant="ghost" onClick={() => setFilters(INITIAL_EXECUTOR_TASK_FILTERS)}>
            <RotateCcw size={16} /> Reset Filters
          </Button>
        </div>

        <div className="executor-filter-grid">
          <div className="input-wrapper">
            <label className="input-label" htmlFor="case-filter-status">
              Status
            </label>
            <select
              id="case-filter-status"
              className="input-field"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as typeof current.status }))}
            >
              <option value="all">All statuses</option>
              {EXECUTOR_TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getExecutorStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="input-wrapper">
            <label className="input-label" htmlFor="case-filter-platform">
              Platform
            </label>
            <select
              id="case-filter-platform"
              className="input-field"
              value={filters.platform}
              onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value }))}
            >
              <option value="all">All platforms</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>

          <div className="input-wrapper">
            <label className="input-label" htmlFor="case-filter-category">
              Category
            </label>
            <select
              id="case-filter-category"
              className="input-field"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="input-wrapper">
            <label className="input-label" htmlFor="case-filter-priority">
              Priority
            </label>
            <select
              id="case-filter-priority"
              className="input-field"
              value={filters.priority}
              onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="all">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  Priority {priority}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Board</p>
            <h2 className="section-title">Kanban Snapshot</h2>
          </div>
        </div>

        {isLoadingTasks ? (
          <p className="inventory-empty">Loading case tasks...</p>
        ) : (
          <div className="executor-board">
            {EXECUTOR_TASK_STATUSES.map((status) => {
              const columnTasks = filteredTasks.filter((task) => task.status === status);
              return (
                <div key={status} className="executor-board-column glass-panel">
                  <div className="executor-board-column-header">
                    <h3>{getExecutorStatusLabel(status)}</h3>
                    <span>{columnTasks.length}</span>
                  </div>

                  <div className="executor-board-column-body">
                    {columnTasks.length === 0 ? (
                      <p className="executor-board-empty">No tasks</p>
                    ) : (
                      columnTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="executor-task-card"
                          onClick={() => openTaskEditor(task)}
                        >
                          <div className="executor-task-card-top">
                            <strong>{task.platform}</strong>
                            <span>Priority {task.priority}</span>
                          </div>
                          <p>{task.category}</p>
                          {task.is_recurring_payment ? (
                            <span className="item-secondary">
                              Recurring • {formatPaymentRailLabel(task.payment_rail)} • {formatInrFromPaise(task.monthly_amount_paise)} / month
                            </span>
                          ) : null}
                          <span className="item-secondary">Evidence: {task.evidence_count}</span>
                          {task.reference_number ? <span className="item-secondary">Ref: {task.reference_number}</span> : null}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Activity</p>
            <h2 className="section-title">Case Timeline</h2>
            <p className="dash-subtitle">Uploads, scan completions, task updates, and report views appear here.</p>
          </div>
        </div>

        {isLoadingActivity ? (
          <p className="inventory-empty">Loading case activity...</p>
        ) : activity.length === 0 ? (
          <p className="inventory-empty">No case activity recorded yet.</p>
        ) : (
          <div className="executor-activity-list">
            {activity.map((event) => (
              <div key={`${event.timestamp}-${event.event_type}-${event.evidence_id || event.task_id || 'case'}`} className="executor-activity-item">
                <div className="executor-activity-item-header">
                  <strong>{event.message}</strong>
                  <span>{formatExecutorTimestamp(event.timestamp)}</span>
                </div>
                <p className="item-secondary">{event.actor_label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">List</p>
            <h2 className="section-title">Filtered Tasks</h2>
          </div>
        </div>

        {isLoadingTasks ? (
          <p className="inventory-empty">Loading case tasks...</p>
        ) : filteredTasks.length === 0 ? (
          <p className="inventory-empty">No tasks match the current filters.</p>
        ) : (
          <div className="inventory-list">
            {filteredTasks.map((task) => (
              <div key={task.id} className="inventory-item glass-panel executor-list-item">
                <div className="item-meta">
                  <div className="item-badge">{task.category}</div>
                  <h4>{task.platform}</h4>
                  <p className="item-secondary">
                    {getExecutorStatusLabel(task.status)} • Priority {task.priority}
                  </p>
                  {task.is_recurring_payment ? (
                    <p className="item-secondary">
                      Recurring: {formatPaymentRailLabel(task.payment_rail)} • {formatInrFromPaise(task.monthly_amount_paise)} / month
                    </p>
                  ) : null}
                  {task.is_recurring_payment && task.payment_reference_hint ? (
                    <p className="item-secondary">Payment reference: {task.payment_reference_hint}</p>
                  ) : null}
                  <p className="item-secondary">Evidence files: {task.evidence_count}</p>
                  {task.reference_number ? <p className="item-secondary">Reference: {task.reference_number}</p> : null}
                  {task.submitted_date ? <p className="item-secondary">Submitted: {task.submitted_date}</p> : null}
                  {task.notes ? <p className="item-secondary">{task.notes}</p> : null}
                </div>
                <div className="inventory-item-actions">
                  <Button type="button" size="sm" variant="secondary" onClick={() => openTaskEditor(task)}>
                    <PencilLine size={14} /> Edit Task
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
