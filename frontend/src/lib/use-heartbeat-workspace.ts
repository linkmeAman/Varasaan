'use client';

import { useEffect, useState } from 'react';

import { apiClient, type HeartbeatResponse } from './api-client';
import { readApiErrorMessage } from './api-errors';
import { useAuth } from './auth-context';

export function useHeartbeatWorkspace() {
  const { user } = useAuth();

  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [cadence, setCadence] = useState<'monthly' | 'quarterly'>('monthly');
  const [enabled, setEnabled] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');

  const refreshHeartbeat = async () => {
    setLoadingAction('load');
    setError('');

    try {
      const currentHeartbeat = await apiClient.getHeartbeat();
      setHeartbeat(currentHeartbeat);
      if (currentHeartbeat.cadence) {
        setCadence(currentHeartbeat.cadence);
      }
      setEnabled(currentHeartbeat.enabled || !currentHeartbeat.configured);
      return currentHeartbeat;
    } catch (heartbeatError) {
      setError(readApiErrorMessage(heartbeatError, 'Unable to load heartbeat settings right now.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshHeartbeat();
  }, [user]);

  const saveHeartbeat = async () => {
    setLoadingAction('save');
    setFeedback('');
    setError('');

    try {
      const updated = await apiClient.upsertHeartbeat({
        body: {
          cadence,
          enabled,
        },
      });
      setHeartbeat(updated);
      setFeedback(enabled ? 'Heartbeat schedule saved.' : 'Heartbeat paused.');
      return updated;
    } catch (heartbeatError) {
      setError(readApiErrorMessage(heartbeatError, 'Unable to save your heartbeat settings.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  const checkInHeartbeat = async () => {
    setLoadingAction('checkin');
    setFeedback('');
    setError('');

    try {
      const updated = await apiClient.checkInHeartbeat();
      setHeartbeat(updated);
      setCadence(updated.cadence || cadence);
      setEnabled(updated.enabled);
      setFeedback('Heartbeat check-in recorded.');
      return updated;
    } catch (heartbeatError) {
      setError(readApiErrorMessage(heartbeatError, 'Unable to record your heartbeat check-in.'));
      return null;
    } finally {
      setLoadingAction('');
    }
  };

  return {
    heartbeat,
    cadence,
    enabled,
    feedback,
    error,
    loadingAction,
    setCadence,
    setEnabled,
    refreshHeartbeat,
    saveHeartbeat,
    checkInHeartbeat,
  };
}
