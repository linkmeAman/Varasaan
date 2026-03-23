'use client';

import { CreditCard, RefreshCw } from 'lucide-react';

import { Button } from '../../../components/ui/Button';
import { useBillingWorkspace } from '../../../lib/use-billing-workspace';

export function BillingScreen() {
  const { checkout, paymentStatus, feedback, error, loadingAction, isVerifying, createCheckout, pollPaymentStatus } =
    useBillingWorkspace();

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <div>
          <p className="item-badge">Plans</p>
          <h2 className="dash-title">Plans and Billing</h2>
          <p className="dash-subtitle">Choose a plan to get started. Essential covers planning tools; Executor adds post-loss case management.</p>
        </div>
      </div>

      {feedback ? <p className="inventory-feedback">{feedback}</p> : null}
      {error ? <p className="input-error-msg">{error}</p> : null}

      <section className="inventory-panel glass-panel">
        <h3 className="section-title">Select a Plan</h3>
        <div className="inventory-actions-row">
          <Button type="button" onClick={() => void createCheckout('essential')} isLoading={loadingAction === 'checkout'}>
            <CreditCard size={16} /> Essential &mdash; &#x20B9;999/month
          </Button>
          <Button type="button" onClick={() => void createCheckout('executor')} isLoading={loadingAction === 'checkout'}>
            <CreditCard size={16} /> Executor &mdash; &#x20B9;2,499/month
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
