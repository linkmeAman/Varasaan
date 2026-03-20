'use client';

import { useState } from 'react';

import { apiClient, type PaymentCheckoutResponse, type PaymentStatusResponse } from './api-client';
import { readApiErrorMessage } from './api-errors';
import { sleep } from './sleep';

type RazorpayWindow = Window &
  typeof globalThis & {
    Razorpay?: new (options: {
      key?: string | null;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: () => Promise<void>;
    }) => { open: () => void };
  };

async function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentWindow = window as RazorpayWindow;
  if (currentWindow.Razorpay) {
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

function isTerminalStatus(status: PaymentStatusResponse['status']): boolean {
  return status === 'captured' || status === 'failed' || status === 'refunded';
}

export function useBillingWorkspace() {
  const [checkout, setCheckout] = useState<PaymentCheckoutResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const pollPaymentStatus = async (orderId: string) => {
    setLoadingAction('verify');
    setIsVerifying(true);
    setError('');
    setFeedback('Verifying payment status...');

    try {
      let latest: PaymentStatusResponse | null = null;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        latest = await apiClient.getPayment({ orderId });
        setPaymentStatus(latest);

        if (isTerminalStatus(latest.status)) {
          setFeedback(`Payment ${latest.status}.`);
          return latest;
        }

        await sleep(2000);
      }

      setFeedback('Verification timed out. You can retry status polling.');
      return latest;
    } catch (statusError) {
      setError(readApiErrorMessage(statusError, 'Unable to fetch payment status.'));
      return null;
    } finally {
      setIsVerifying(false);
      setLoadingAction('');
    }
  };

  const createCheckout = async (amountRupees: string) => {
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
      setPaymentStatus(null);

      const canLoadRazorpay = await ensureRazorpayScript();
      const currentWindow = window as RazorpayWindow;
      if (canLoadRazorpay && currentWindow.Razorpay && created.checkout_key_id) {
        const instance = new currentWindow.Razorpay({
          key: created.checkout_key_id,
          amount: created.amount_paise,
          currency: created.currency,
          name: 'Varasaan',
          description: 'Digital legacy planning checkout',
          order_id: created.provider_order_id,
          handler: async () => {
            await pollPaymentStatus(created.order_id);
          },
        });
        instance.open();
      } else {
        setFeedback('Checkout order created. Razorpay key/script unavailable, so this is API-only mode.');
      }

      return created;
    } catch (checkoutError) {
      setError(readApiErrorMessage(checkoutError, 'Unable to create checkout order.'));
      return null;
    } finally {
      if (!isVerifying) {
        setLoadingAction('');
      }
    }
  };

  return {
    checkout,
    paymentStatus,
    feedback,
    error,
    loadingAction,
    isVerifying,
    createCheckout,
    pollPaymentStatus,
  };
}
