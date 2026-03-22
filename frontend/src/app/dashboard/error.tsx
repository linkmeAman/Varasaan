'use client';

import { Button } from '../../components/ui/Button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dashboard-shell-root dashboard-shell-loading">
      <div className="dashboard-shell-error glass-panel">
        <h2>Dashboard failed to load</h2>
        <p>{error.message || 'Something went wrong while loading this workspace.'}</p>
        <Button type="button" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  );
}

