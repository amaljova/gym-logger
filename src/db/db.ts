import Dexie, { type Table } from 'dexie';

export interface WorkoutNote {
  id: string;
  workoutId: string;
  exerciseId: string;
  note: string;
  updatedAt: number;
}

export interface Exercise {
  id: string; // UUID
  name: string;
  muscleGroup: string;
  isCustom: boolean;
  updatedAt: number;
}

export interface RoutineExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
}

export interface Routine {
  id: string; // UUID
  name: string;
  dayLabel?: string; // e.g. "Push day"
  exercises: RoutineExercise[];
  showOnTrain?: boolean; // undefined === true (shown on the Train page)
  order?: number;        // manual sort order; undefined sorts last
  updatedAt: number;
}

export interface Workout {
  id: string; // UUID
  date: number; // timestamp
  routineId?: string; // optional
  status: 'active' | 'completed';
  updatedAt: number;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string; // UUID
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  completedAt?: number; // timestamp
  setType?: SetType; // undefined === 'normal' (kept optional for old records)
  updatedAt: number;
}

class GymLoggerDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  workouts!: Table<Workout, string>;
  sets!: Table<WorkoutSet, string>;
  workoutNotes!: Table<WorkoutNote, string>;

  constructor() {
    super('GymLoggerDatabase');
    this.version(1).stores({
      exercises: 'id, name, muscleGroup, isCustom, updatedAt',
      routines: 'id, name, updatedAt',
      workouts: 'id, date, routineId, status, updatedAt',
      sets: 'id, workoutId, exerciseId, completedAt, updatedAt',
    });
    this.version(2).stores({
      exercises: 'id, name, muscleGroup, isCustom, updatedAt',
      routines: 'id, name, updatedAt',
      workouts: 'id, date, routineId, status, updatedAt',
      sets: 'id, workoutId, exerciseId, completedAt, updatedAt',
      workoutNotes: 'id, workoutId, exerciseId, updatedAt',
    });
  }
}

export const db = new GymLoggerDatabase();

// Backup and Export functions
export async function exportDatabaseToJson(): Promise<string> {
  const exercises = await db.exercises.toArray();
  const routines = await db.routines.toArray();
  const workouts = await db.workouts.toArray();
  const sets = await db.sets.toArray();

  const workoutNotes = await db.workoutNotes.toArray();

  const backup = {
    version: 2,
    exportedAt: Date.now(),
    data: {
      exercises,
      routines,
      workouts,
      sets,
      workoutNotes,
    }
  };

  return JSON.stringify(backup, null, 2);
}

// Restore database from JSON
export async function importDatabaseFromJson(jsonString: string, overwrite = true): Promise<void> {
  const backup = JSON.parse(jsonString);
  if (!backup || !backup.data) {
    throw new Error('Invalid backup file format.');
  }

  const { exercises, routines, workouts, sets, workoutNotes } = backup.data;

  await db.transaction('rw', [db.exercises, db.routines, db.workouts, db.sets, db.workoutNotes], async () => {
    if (overwrite) {
      await db.exercises.clear();
      await db.routines.clear();
      await db.workouts.clear();
      await db.sets.clear();
      await db.workoutNotes.clear();
    }

    if (Array.isArray(exercises)) await db.exercises.bulkPut(exercises);
    if (Array.isArray(routines)) await db.routines.bulkPut(routines);
    if (Array.isArray(workouts)) await db.workouts.bulkPut(workouts);
    if (Array.isArray(sets)) await db.sets.bulkPut(sets);
    if (Array.isArray(workoutNotes)) await db.workoutNotes.bulkPut(workoutNotes);
  });
}
