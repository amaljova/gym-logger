import type { Exercise } from '../db/db';

/** Built-in muscle groups, shown first and in this order. */
export const BASE_MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];

/**
 * Returns the base groups plus any custom groups present in the library
 * (so a user-created group shows up in filters and pickers everywhere).
 */
export function getMuscleGroups(exercises: Exercise[]): string[] {
  const seen = new Set(BASE_MUSCLE_GROUPS);
  const extras: string[] = [];
  for (const e of exercises) {
    if (e.muscleGroup && !seen.has(e.muscleGroup)) {
      seen.add(e.muscleGroup);
      extras.push(e.muscleGroup);
    }
  }
  extras.sort((a, b) => a.localeCompare(b));
  return [...BASE_MUSCLE_GROUPS, ...extras];
}
