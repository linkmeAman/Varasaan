'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '../../../../../components/ui/Button';
import {
  formatExecutorDate,
  formatExecutorTimestamp,
  getExecutorStatusLabel,
  useExecutorCaseReport,
} from '../../../../../lib/use-executor-cases';

type ExecutorCaseReportScreenProps = {
  caseId: string;
};

export function ExecutorCaseReportScreen({ caseId }: ExecutorCaseReportScreenProps) {
  const router = useRouter();
  const { report, isLoadingReport, error } = useExecutorCaseReport(caseId);

  if (isLoadingReport) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="inventory-empty">Loading closure report...</p>
        </section>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="input-error-msg">{error || 'Unable to load this closure report.'}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="executor-container animate-fade-in report-print-page">
      <header className="executor-header glass-panel executor-report-header">
        <div className="executor-header-content">
          <div className={`status-badge ${report.report_ready ? 'live' : ''}`}>{report.report_ready ? 'Report ready' : 'Draft report'}</div>
          <h1 className="executor-title">Closure Report</h1>
          <p className="executor-subtitle">
            {report.summary.owner_name} • {report.summary.owner_email}
          </p>
        </div>

        <div className="report-print-actions">
          <Button type="button" variant="ghost" onClick={() => router.push(`/executor/cases/${caseId}`)}>
            <ArrowLeft size={16} /> Back to Workspace
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save as PDF
          </Button>
        </div>
      </header>

      <section className="inventory-panel glass-panel executor-section report-summary-grid">
        <div className="report-summary-card">
          <span>Generated</span>
          <strong>{formatExecutorTimestamp(report.summary.generated_at)}</strong>
        </div>
        <div className="report-summary-card">
          <span>Activated</span>
          <strong>{formatExecutorTimestamp(report.summary.activated_at)}</strong>
        </div>
        <div className="report-summary-card">
          <span>Tasks</span>
          <strong>{report.summary.total_tasks}</strong>
        </div>
        <div className="report-summary-card">
          <span>Clean evidence</span>
          <strong>{report.summary.clean_evidence_count}</strong>
        </div>
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Status</p>
            <h2 className="section-title">Report Readiness</h2>
          </div>
        </div>
        <div className="report-readiness-copy">
          <p className="item-secondary">
            Case status: {getExecutorStatusLabel(report.summary.status)}. Task completion is tracked from the live board and only clean evidence references are included below.
          </p>
        </div>
        {report.warnings.length > 0 ? (
          <div className="executor-report-warning-list">
            {report.warnings.map((warning) => (
              <div key={warning} className="heartbeat-warning">
                <p>{warning}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="inventory-feedback">All tasks are terminal and each task has clean evidence references available.</p>
        )}
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Tasks</p>
            <h2 className="section-title">Task Table</h2>
          </div>
        </div>
        <div className="executor-report-table-wrapper">
          <table className="executor-report-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Reference</th>
                <th>Submitted</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {report.task_rows.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.platform}</strong>
                    <div className="item-secondary">{task.category}</div>
                  </td>
                  <td>{getExecutorStatusLabel(task.status)}</td>
                  <td>{task.priority}</td>
                  <td>{task.reference_number || 'Not provided'}</td>
                  <td>{task.submitted_date || 'Not provided'}</td>
                  <td>
                    {task.clean_evidence_count} clean / {task.evidence_count} total
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Evidence</p>
            <h2 className="section-title">Clean Evidence References</h2>
          </div>
        </div>
        {report.clean_evidence_references.length === 0 ? (
          <p className="inventory-empty">No clean evidence is available for this report yet.</p>
        ) : (
          <div className="executor-evidence-list">
            {report.clean_evidence_references.map((reference) => (
              <div key={reference.evidence_id} className="executor-evidence-item glass-panel">
                <div className="item-meta">
                  <div className="executor-evidence-item-header">
                    <strong>{reference.file_name}</strong>
                    <span className="status-indicator success">{reference.content_type}</span>
                  </div>
                  <p className="item-secondary">
                    {reference.platform} • {reference.category}
                  </p>
                  <p className="item-secondary">Captured: {formatExecutorTimestamp(reference.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Timeline</p>
            <h2 className="section-title">Case Activity</h2>
          </div>
        </div>
        <div className="executor-activity-list">
          {report.activity_timeline.map((event) => (
            <div key={`${event.timestamp}-${event.event_type}-${event.evidence_id || event.task_id || 'case'}`} className="executor-activity-item">
              <div className="executor-activity-item-header">
                <strong>{event.message}</strong>
                <span>{formatExecutorTimestamp(event.timestamp)}</span>
              </div>
              <p className="item-secondary">{event.actor_label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Closure</p>
            <h2 className="section-title">Printable Notes</h2>
          </div>
        </div>
        <div className="report-readiness-copy">
          <p className="item-secondary">
            Use the browser print dialog to save this live report as PDF. Generated on {formatExecutorDate(report.summary.generated_at)} with current board state, clean evidence references, and case activity.
          </p>
        </div>
      </section>
    </div>
  );
}
