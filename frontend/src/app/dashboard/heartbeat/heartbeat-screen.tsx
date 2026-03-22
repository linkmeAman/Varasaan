'use client';

import { Activity, AlertTriangle, CalendarClock, RefreshCw } from 'lucide-react';

import { Button } from '../../../components/ui/Button';
import { useHeartbeatWorkspace } from '../../../lib/use-heartbeat-workspace';

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function HeartbeatScreen() {
  const { heartbeat, cadence, enabled, feedback, error, loadingAction, setCadence, setEnabled, saveHeartbeat, checkInHeartbeat } =
    useHeartbeatWorkspace();

  return (
    <div className="inventory-manager animate-fade-in">
      <section className="inventory-panel glass-panel">
        <div className="heartbeat-hero">
          <div>
            <p className="item-badge">Heartbeat</p>
            <h2 className="dash-title">Check-in cadence</h2>
            <p className="dash-subtitle">Decide how often you confirm that everything is still in planning mode.</p>
          </div>
          <div className="heartbeat-status-card">
            <Activity size={20} />
            <div>
              <p className="dashboard-sidebar-user-label">Current status</p>
              <p className="dashboard-sidebar-user-value">{heartbeat?.status || 'unconfigured'}</p>
            </div>
          </div>
        </div>

        {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
        {error ? <p className="input-error-msg">{error}</p> : null}

        <div className="heartbeat-grid">
          <div className="heartbeat-card glass-panel">
            <label className="input-label" htmlFor="heartbeat-cadence">
              Check-in cadence <span className="input-required">*</span>
            </label>
            <select
              id="heartbeat-cadence"
              className="input-field"
              value={cadence}
              onChange={(event) => setCadence(event.target.value as 'monthly' | 'quarterly')}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>

            <label className="heartbeat-toggle">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <span>Heartbeat reminders enabled</span>
            </label>

            <div className="inventory-actions-row">
              <Button type="button" onClick={() => void saveHeartbeat()} isLoading={loadingAction === 'save'}>
                <CalendarClock size={16} /> Save cadence
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void checkInHeartbeat()}
                disabled={!heartbeat?.configured || !enabled}
                isLoading={loadingAction === 'checkin'}
              >
                <RefreshCw size={16} /> Check in now
              </Button>
            </div>
          </div>

          <div className="heartbeat-card glass-panel">
            <h3 className="section-title">Schedule snapshot</h3>
            <div className="heartbeat-metadata">
              <div>
                <span>Last checked in</span>
                <strong>{formatDate(heartbeat?.last_checked_in_at)}</strong>
              </div>
              <div>
                <span>Next expected check-in</span>
                <strong>{formatDate(heartbeat?.next_expected_at)}</strong>
              </div>
              <div>
                <span>Next action</span>
                <strong>{formatDate(heartbeat?.next_action_at)}</strong>
              </div>
              <div>
                <span>Recovery contacts</span>
                <strong>{heartbeat?.recovery_contact_count ?? 0}</strong>
              </div>
            </div>

            {(heartbeat?.recovery_contact_count ?? 0) === 0 ? (
              <div className="heartbeat-warning">
                <AlertTriangle size={18} />
                <p>Add at least one active recovery-assist trusted contact before relying on escalation.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
