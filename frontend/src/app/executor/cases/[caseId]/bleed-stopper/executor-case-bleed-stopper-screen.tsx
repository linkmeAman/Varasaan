'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '../../../../../components/ui/Button';
import { formatInrFromPaise, formatPaymentRailLabel } from '../../../../../lib/utils';
import {
  formatExecutorTimestamp,
  getExecutorBleedStopperActionLabel,
  getExecutorStatusLabel,
  isExecutorTaskTerminal,
  useExecutorCaseBleedStopper,
} from '../../../../../lib/use-executor-cases';

type ExecutorCaseBleedStopperScreenProps = {
  caseId: string;
};

export function ExecutorCaseBleedStopperScreen({ caseId }: ExecutorCaseBleedStopperScreenProps) {
  const router = useRouter();
  const { bleedStopper, isLoadingBleedStopper, error } = useExecutorCaseBleedStopper(caseId);
  const recurringTasksRequiringActionCount = useMemo(
    () => bleedStopper?.rows.filter((row) => !isExecutorTaskTerminal(row.status)).length || 0,
    [bleedStopper],
  );

  if (isLoadingBleedStopper) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="inventory-empty">Loading subscription bleed stopper...</p>
        </section>
      </div>
    );
  }

  if (!bleedStopper) {
    return (
      <div className="executor-container animate-fade-in">
        <section className="inventory-panel glass-panel">
          <p className="input-error-msg">{error || 'Unable to load this subscription bleed stopper.'}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="executor-container animate-fade-in report-print-page bleed-stopper-print-page">
      <header className="executor-header glass-panel executor-report-header">
        <div className="executor-header-content">
          <div className={`status-badge ${bleedStopper.recurring_task_count > 0 ? 'live' : ''}`}>
            {bleedStopper.recurring_task_count > 0 ? 'Recurring payments detected' : 'No recurring payments'}
          </div>
          <h1 className="executor-title">Subscription Bleed Stopper</h1>
          <p className="executor-subtitle">
            {bleedStopper.summary.owner_name} • {bleedStopper.summary.owner_email}
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
          <span>Activated</span>
          <strong>{formatExecutorTimestamp(bleedStopper.summary.activated_at)}</strong>
        </div>
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
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Checklist</p>
            <h2 className="section-title">Recurring Payment Checklist</h2>
            <p className="dash-subtitle">Rows are sorted by estimated monthly bleed first so the highest-cost subscriptions are handled first.</p>
          </div>
        </div>

        {bleedStopper.rows.length === 0 ? (
          <p className="inventory-empty">No recurring subscriptions were captured in planning mode for this case.</p>
        ) : (
          <div className="bleed-stopper-row-list">
            {bleedStopper.rows.map((row) => (
              <article key={row.task_id} className="bleed-stopper-row glass-panel">
                <div className="bleed-stopper-row-header">
                  <div>
                    <strong>{row.platform}</strong>
                    <p className="item-secondary">
                      {row.category} • {formatPaymentRailLabel(row.payment_rail)}
                    </p>
                    <p className="item-secondary">{getExecutorBleedStopperActionLabel(row.action_type)}</p>
                  </div>
                  <div className="bleed-stopper-row-badges">
                    <span className={`status-indicator ${isExecutorTaskTerminal(row.status) ? 'success' : 'warning'}`}>
                      {getExecutorStatusLabel(row.status)}
                    </span>
                    <span className="status-indicator warning">{formatInrFromPaise(row.monthly_amount_paise)} / month</span>
                  </div>
                </div>

                <div className="bleed-stopper-row-meta">
                  <div>
                    <span>Payment rail</span>
                    <strong>{formatPaymentRailLabel(row.payment_rail)}</strong>
                  </div>
                  <div>
                    <span>Payment reference hint</span>
                    <strong>{row.payment_reference_hint || 'Not provided'}</strong>
                  </div>
                  <div>
                    <span>Action type</span>
                    <strong>{getExecutorBleedStopperActionLabel(row.action_type)}</strong>
                  </div>
                </div>

                <div className="bleed-stopper-steps">
                  <h3 className="section-title">Action Checklist</h3>
                  <ol className="bleed-stopper-step-list">
                    {row.action_steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                {row.letter_template ? (
                  <div className="bleed-stopper-letter">
                    <div className="executor-section-header">
                      <div>
                        <p className="item-badge">Template</p>
                        <h3 className="section-title">Printable Card Dispute Template</h3>
                      </div>
                    </div>
                    <pre>{row.letter_template}</pre>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-panel glass-panel executor-section">
        <div className="executor-section-header">
          <div>
            <p className="item-badge">Print Notes</p>
            <h2 className="section-title">Printable Guidance</h2>
          </div>
        </div>
        <div className="report-readiness-copy">
          <p className="item-secondary">
            Use the browser print dialog to save this live checklist and any card dispute template as PDF. Guidance is generated from case task snapshots, so it stays stable even if planning-mode inventory changes later.
          </p>
          <p className="item-secondary">
            Capture confirmation emails, mandate revocation screenshots, and support ticket numbers back in the task workspace as evidence.
          </p>
        </div>
      </section>
    </div>
  );
}
