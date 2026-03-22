import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { type RecurringPaymentRail } from './api-client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inrCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInrFromPaise(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Not available';
  }
  return inrCurrencyFormatter.format(value / 100);
}

export function formatPaymentRailLabel(rail: RecurringPaymentRail | null | undefined): string {
  switch (rail) {
    case 'card':
      return 'Card';
    case 'upi_autopay':
      return 'UPI Autopay';
    case 'other':
      return 'Other';
    default:
      return 'Not set';
  }
}
