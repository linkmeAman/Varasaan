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
    setFeedback('Checking payment status...');

    try {
      let latest: PaymentStatusResponse | null = null;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        latest = await apiClient.getPayment({ orderId });
        setPaymentStatus(latest);

        if (isTerminalStatus(latest.status)) {
          setFeedback(`Payment status: ${latest.status}.`);
          return latest;
        }

        await sleep(2000);
      }

      setFeedback('Status check timed out. You can retry.');
      return latest;
    } catch (statusError) {
      setError(readApiErrorMessage(statusError, 'Unable to load payment status.'));
      return null;
    } finally {
      setIsVerifying(false);
      setLoadingAction('');
    }
  };

  const createCheckout = async (tier: 'essential' | 'executor') => {
    setLoadingAction('checkout');
    setFeedback('');
    setError('');

    try {
      const created = await apiClient.createCheckout({
        body: { tier },
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
          description: 'Varasaan plan payment',
          order_id: created.provider_order_id,
          handler: async () => {
            await pollPaymentStatus(created.order_id);
          },
        });
        instance.open();
      } else {
        setFeedback('Payment check created. This browser could not open Razorpay automatically, so you can track status from this page.');
      }

      return created;
    } catch (checkoutError) {
      setError(readApiErrorMessage(checkoutError, 'Unable to start payment check.'));
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
