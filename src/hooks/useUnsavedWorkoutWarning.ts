import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/**
 * Warns the user (native browser "Leave site?" dialog) when they try to close
 * or reload the tab while a workout is still active (not yet finished/saved).
 * Returns whether an active workout currently exists, in case the UI wants it.
 */
export function useUnsavedWorkoutWarning(): boolean {
  const activeWorkout = useLiveQuery(() => db.workouts.filter(w => w.status === 'active').first());
  const hasActive = !!activeWorkout;

  useEffect(() => {
    if (!hasActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required by some browsers to trigger the confirmation prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActive]);

  return hasActive;
}
