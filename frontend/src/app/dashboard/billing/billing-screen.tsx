'use client';

import { CreditCard, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useBillingWorkspace } from '../../../lib/use-billing-workspace';

export function BillingScreen() {
  const [amountRupees, setAmountRupees] = useState('999');
  const { checkout, paymentStatus, feedback, error, loadingAction, isVerifying, createCheckout, pollPaymentStatus } =
    useBillingWorkspace();

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Plans</p>
          <h2 className="dash-title">Plans and Billing</h2>
          <p className="dash-subtitle">This MVP screen validates checkout flow while tiered plans, entitlements, and invoices are still in progress.</p>
        </div>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Start Payment Check</h3>
        <div className="inventory-actions-row">
          <Input label="Amount (INR)" type="number" min={1} value={amountRupees} onChange={(event) => setAmountRupees(event.target.value)} />
          <Button type="button" onClick={() => void createCheckout(amountRupees)} isLoading={loadingAction === 'checkout'}>
            <CreditCard size={16} /> Start Payment Check
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <div className="inventory-actions-row">
          <h3 className="section-title">Payment Activity</h3>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (checkout) {
                void pollPaymentStatus(checkout.order_id);
              }
            }}
            isLoading={loadingAction === 'verify'}
            disabled={!checkout}
          >
            <RefreshCw size={16} /> {isVerifying ? 'Verifying...' : 'Verify Status'}
          </Button>
        </div>

        {!checkout ? (
          <p className="inventory-empty">No payment check started yet.</p>
        ) : (
          <div className="inventory-list">
            <div className="inventory-item glass-panel">
              <div className="item-meta">
                <div className="item-badge">payment check</div>
                <h4>{checkout.order_id}</h4>
                <p className="item-secondary">
                  provider: {checkout.provider} / provider_order_id: {checkout.provider_order_id}
                </p>
              </div>
              <div className="item-status">
                <span className="status-indicator warning">{checkout.status}</span>
              </div>
            </div>
            {paymentStatus ? (
              <div className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">latest status</div>
                  <h4>{paymentStatus.order_id}</h4>
                  <p className="item-secondary">payment_id: {paymentStatus.payment_id || 'pending'}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${paymentStatus.status === 'captured' ? 'success' : 'warning'}`}>
                    {paymentStatus.status} (seq {paymentStatus.event_sequence})
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
