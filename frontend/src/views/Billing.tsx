'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiClient, type PaymentCheckoutResponse, type PaymentStatusResponse } from '../lib/api-client';
import { useAuthGuard } from '../lib/use-auth-guard';

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

async function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.Razorpay) {
    return true;
  }

  return await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Billing() {
  const { isLoading: authLoading } = useAuthGuard();

  const [amountRupees, setAmountRupees] = useState('999');
  const [checkout, setCheckout] = useState<PaymentCheckoutResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const handleCheckout = async () => {
    setLoadingAction('checkout');
    setFeedback('');
    setError('');

    const amountPaise = Math.max(100, Math.round((Number(amountRupees) || 0) * 100));

    try {
      const created = await apiClient.createCheckout({
        body: {
          amount_paise: amountPaise,
          currency: 'INR',
        },
      });
      setCheckout(created);

      const canLoadRazorpay = await ensureRazorpayScript();
      if (canLoadRazorpay && window.Razorpay && created.checkout_key_id) {
        const instance = new window.Razorpay({
          key: created.checkout_key_id,
          amount: created.amount_paise,
          currency: created.currency,
          name: 'Varasaan',
          description: 'Digital legacy planning checkout',
          order_id: created.provider_order_id,
          handler: async () => {
            const refreshed = await apiClient.getPayment({ orderId: created.order_id });
            setPaymentStatus(refreshed);
          },
        });
        instance.open();
      } else {
        setFeedback('Checkout order created. Razorpay key/script unavailable, so this is API-only mode.');
      }
    } catch (checkoutError) {
      setError(errorMessage(checkoutError, 'Unable to create checkout order.'));
    } finally {
      setLoadingAction('');
    }
  };

  const handleRefreshPaymentStatus = async () => {
    if (!checkout) {
      setError('Create a checkout order first.');
      return;
    }

    setLoadingAction('status');
    setFeedback('');
    setError('');

    try {
      const status = await apiClient.getPayment({ orderId: checkout.order_id });
      setPaymentStatus(status);
    } catch (statusError) {
      setError(errorMessage(statusError, 'Unable to fetch payment status.'));
    } finally {
      setLoadingAction('');
    }
  };

  if (authLoading) {
    return (
      <div className="inventory-manager animate-fade-in">
        <p className="inventory-empty">Loading billing workspace...</p>
      </div>
    );
  }

  return (
    <div className="inventory-manager animate-fade-in">
      <div className="inventory-manager-header">
        <Link href="/dashboard" className="inventory-back-link">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="dash-title">Billing</h1>
        <p className="dash-subtitle">Create checkout orders and monitor payment status.</p>
      </div>

      {feedback && <p className="inventory-feedback">{feedback}</p>}
      {error && <p className="input-error-msg">{error}</p>}

      <section className="inventory-panel glass-panel">
        <h2 className="section-title">Create Checkout</h2>
        <div className="inventory-actions-row">
          <Input
            label="Amount (INR)"
            type="number"
            min={1}
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
          />
          <Button type="button" onClick={handleCheckout} isLoading={loadingAction === 'checkout'}>
            <CreditCard size={16} /> Create Order
          </Button>
        </div>
      </section>

      <section className="inventory-panel glass-panel">
        <div className="inventory-actions-row">
          <h2 className="section-title">Payment Status</h2>
          <Button type="button" variant="ghost" onClick={handleRefreshPaymentStatus} isLoading={loadingAction === 'status'}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>

        {!checkout ? (
          <p className="inventory-empty">No checkout created yet.</p>
        ) : (
          <div className="inventory-list">
            <div className="inventory-item glass-panel">
              <div className="item-meta">
                <div className="item-badge">order</div>
                <h4>{checkout.order_id}</h4>
                <p className="item-secondary">
                  provider: {checkout.provider} / provider_order_id: {checkout.provider_order_id}
                </p>
              </div>
              <div className="item-status">
                <span className="status-indicator warning">{checkout.status}</span>
              </div>
            </div>
            {paymentStatus && (
              <div className="inventory-item glass-panel">
                <div className="item-meta">
                  <div className="item-badge">status</div>
                  <h4>{paymentStatus.order_id}</h4>
                  <p className="item-secondary">payment_id: {paymentStatus.payment_id || 'pending'}</p>
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${paymentStatus.status === 'captured' ? 'success' : 'warning'}`}>
                    {paymentStatus.status} (seq {paymentStatus.event_sequence})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
