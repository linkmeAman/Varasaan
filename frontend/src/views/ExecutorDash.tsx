import { Users, FileCheck, Anchor } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function ExecutorDash() {
  return (
    <div className="executor-container animate-fade-in">
      <header className="executor-header glass-panel">
        <div className="executor-header-content">
          <div className="status-badge live">Active Case</div>
          <h1 className="executor-title">Managing the Estate of Rajesh Sharma</h1>
          <p className="executor-subtitle">
            Take this one step at a time. We've compiled the verified digital inventory. Follow the guided checklist
            below to secure, recover, or responsibly close these endpoints.
          </p>
        </div>

        <div className="executor-quick-actions">
          <Button variant="secondary" className="action-btn">
            <Anchor size={16} /> Legal Support
          </Button>
          <Button variant="secondary" className="action-btn">
            <Users size={16} /> Manage Co-Executors
          </Button>
        </div>
      </header>

      <section className="task-section">
        <h2 className="section-heading">Immediate Closure Actions</h2>

        <div className="task-grid">
          <div className="task-card urgent glass-panel">
            <div className="task-header">
              <span className="platform-tag finance">HDFC Demat Account</span>
              <span className="urgency-dot red"></span>
            </div>
            <h3 className="task-title">Submit Transmission Request</h3>
            <p className="task-desc">
              Requires physical branch submission of the notarized death certificate and nominee forms.
            </p>
            <div className="task-footer">
              <Button size="sm" variant="primary">
                Generate Legal Packet
              </Button>
            </div>
          </div>

          <div className="task-card pending glass-panel">
            <div className="task-header">
              <span className="platform-tag communication">Google Account (Gmail)</span>
              <span className="urgency-dot yellow"></span>
            </div>
            <h3 className="task-title">Initiate Inactive Account Manager</h3>
            <p className="task-desc">Waiting on Google Trust and Safety review. Time elapsed: 12 days.</p>
            <div className="task-footer">
              <Button size="sm" variant="secondary" disabled>
                Request Pending
              </Button>
            </div>
          </div>

          <div className="task-card completed glass-panel">
            <div className="task-header">
              <span className="platform-tag social">Meta (LinkedIn)</span>
              <span className="urgency-dot green"></span>
            </div>
            <h3 className="task-title">Account Memorialization</h3>
            <p className="task-desc">Successfully converted to a memorialized state.</p>
            <div className="task-footer">
              <span className="success-text">
                <FileCheck size={14} /> Completed
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
