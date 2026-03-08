import { Plus, ListTodo, ShieldAlert, FolderOpen } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  return (
    <div className="dashboard-container animate-fade-in">
      
      {/* Dashboard Header */}
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Digital Inventory</h1>
          <p className="dash-subtitle">Planning Mode • securely encrypting your footprint</p>
        </div>
        <button className="btn-primary">
          <Plus size={18} /> Add Account
        </button>
      </header>

      {/* Dashboard Stats / Quick Glance */}
      <div className="dash-stats">
        <div className="stat-card glass-panel">
          <div className="stat-icon info"><FolderOpen size={24} /></div>
          <div className="stat-data">
            <h3>4</h3>
            <p>Mapped Accounts</p>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-icon warning"><ShieldAlert size={24} /></div>
          <div className="stat-data">
            <h3>2</h3>
            <p>Missing Protocols</p>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon success"><ListTodo size={24} /></div>
          <div className="stat-data">
            <h3>0 / 4</h3>
            <p>Closure Packets Pre-generated</p>
          </div>
        </div>
      </div>

      {/* Inventory List Outline */}
      <section className="inventory-section">
        <h2 className="section-title">Critical Endpoints</h2>
        
        <div className="inventory-list">
          {/* Example Item 1 */}
          <div className="inventory-item glass-panel">
            <div className="item-meta">
              <div className="item-badge finance">Finance</div>
              <h4>Zerodha Demat</h4>
              <p className="item-secondary">Trading & Holdings</p>
            </div>
            <div className="item-status">
               <span className="status-indicator warning">Needs Proof</span>
            </div>
          </div>

          {/* Example Item 2 */}
          <div className="inventory-item glass-panel">
             <div className="item-meta">
              <div className="item-badge email">Communication</div>
              <h4>Primary Gmail</h4>
              <p className="item-secondary">Google Workspace Administrator</p>
            </div>
            <div className="item-status">
               <span className="status-indicator success">Secured</span>
            </div>
          </div>
        </div>
      </section>
      
    </div>
  );
}
