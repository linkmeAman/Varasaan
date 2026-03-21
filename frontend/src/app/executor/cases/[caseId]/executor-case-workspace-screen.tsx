'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PencilLine, RotateCcw } from 'lucide-react';

import { Dialog } from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { type CaseTaskResponse } from '../../../../lib/api-client';
import {
  EXECUTOR_TASK_STATUSES,
  INITIAL_EXECUTOR_TASK_FILTERS,
  getExecutorCaseLabel,
  getExecutorStatusLabel,
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
    filters,
    isLoadingCase,
    isLoadingTasks,
    feedback,
    error,
    loadingAction,
    setFilters,
    updateTask,
  } = useExecutorCase(caseId);
  const [selectedTask, setSelectedTask] = useState<CaseTaskResponse | null>(null);
  const [draft, setDraft] = useState<ExecutorTaskDraft | null>(null);

  const platformOptions = Array.from(new Set(tasks.map((task) => task.platform))).sort();
  const categoryOptions = Array.from(new Set(tasks.map((task) => task.category))).sort();
  const priorityOptions = Array.from(new Set(tasks.map((task) => String(task.priority)))).sort((left, right) => Number(right) - Number(left));

  const filteredTasks = tasks.filter((task) => {
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
  });

  const openTaskEditor = (task: CaseTaskResponse) => {
    setSelectedTask(task);
    setDraft(createTaskDraft(task));
  };

  const closeTaskEditor = () => {
    setSelectedTask(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!selectedTask || !draft) {
      return;
    }

    const updatedTask = await updateTask(selectedTask.id, draft);
    if (updatedTask) {
      setSelectedTask(updatedTask);
      setDraft(createTaskDraft(updatedTask));
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
              <p className="item-badge">Activation</p>
              <h1 className="section-title">{getExecutorCaseLabel(caseSummary)}</h1>
              <p className="dash-subtitle">This case is still pending activation. Return to the executor landing page to upload the death certificate.</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => router.push('/executor')}>
            <ArrowLeft size={16} /> Back to Cases
          </Button>
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
      </header>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

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
