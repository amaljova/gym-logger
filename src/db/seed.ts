import { db, type Exercise, type Routine } from './db';
import { uuid } from '../utils/uuid';

const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'updatedAt'>[] = [
  { name: 'Bench Press', muscleGroup: 'Chest', isCustom: false },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', isCustom: false },
  { name: 'Barbell Squat', muscleGroup: 'Legs', isCustom: false },
  { name: 'Leg Press', muscleGroup: 'Legs', isCustom: false },
  { name: 'Lying Leg Curl', muscleGroup: 'Legs', isCustom: false },
  { name: 'Deadlift', muscleGroup: 'Back', isCustom: false },
  { name: 'Pull-up', muscleGroup: 'Back', isCustom: false },
  { name: 'Barbell Row', muscleGroup: 'Back', isCustom: false },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', isCustom: false },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', isCustom: false },
  { name: 'Dumbbell Bicep Curl', muscleGroup: 'Arms', isCustom: false },
  { name: 'Tricep Pushdown', muscleGroup: 'Arms', isCustom: false },
  { name: 'Plank', muscleGroup: 'Core', isCustom: false },
  { name: 'Hanging Knee Raise', muscleGroup: 'Core', isCustom: false },
];

export async function seedDatabase() {
  const exerciseCount = await db.exercises.count();
  const now = Date.now();

  let exercises: Exercise[] = [];

  if (exerciseCount === 0) {
    exercises = DEFAULT_EXERCISES.map(ex => ({
      ...ex,
      id: uuid(),
      updatedAt: now,
    }));
    await db.exercises.bulkAdd(exercises);
    console.log('Seeded default exercises successfully.');
  } else {
    exercises = await db.exercises.toArray();
  }

  const routineCount = await db.routines.count();
  if (routineCount === 0) {
    const exerciseMap = new Map<string, string>();
    exercises.forEach(ex => exerciseMap.set(ex.name, ex.id));

    const getExId = (name: string) => exerciseMap.get(name) || '';

    const defaultRoutines: Routine[] = [
      {
        id: uuid(),
        name: 'Push Day',
        dayLabel: 'Chest, Shoulders & Triceps',
        updatedAt: now,
        exercises: [
          { exerciseId: getExId('Bench Press'), targetSets: 4, targetReps: 8, targetWeight: 60 },
          { exerciseId: getExId('Overhead Press'), targetSets: 3, targetReps: 8, targetWeight: 40 },
          { exerciseId: getExId('Lateral Raise'), targetSets: 3, targetReps: 12, targetWeight: 10 },
          { exerciseId: getExId('Tricep Pushdown'), targetSets: 3, targetReps: 10, targetWeight: 25 },
        ].filter(r => r.exerciseId !== ''),
      },
      {
        id: uuid(),
        name: 'Pull Day',
        dayLabel: 'Back & Biceps',
        updatedAt: now,
        exercises: [
          { exerciseId: getExId('Deadlift'), targetSets: 3, targetReps: 5, targetWeight: 100 },
          { exerciseId: getExId('Pull-up'), targetSets: 3, targetReps: 8, targetWeight: 0 },
          { exerciseId: getExId('Barbell Row'), targetSets: 3, targetReps: 8, targetWeight: 50 },
          { exerciseId: getExId('Dumbbell Bicep Curl'), targetSets: 3, targetReps: 10, targetWeight: 12 },
        ].filter(r => r.exerciseId !== ''),
      },
      {
        id: uuid(),
        name: 'Leg Day',
        dayLabel: 'Quads, Hamstrings & Calves',
        updatedAt: now,
        exercises: [
          { exerciseId: getExId('Barbell Squat'), targetSets: 4, targetReps: 6, targetWeight: 80 },
          { exerciseId: getExId('Leg Press'), targetSets: 3, targetReps: 10, targetWeight: 120 },
          { exerciseId: getExId('Lying Leg Curl'), targetSets: 3, targetReps: 12, targetWeight: 30 },
        ].filter(r => r.exerciseId !== ''),
      },
    ];

    await db.routines.bulkAdd(defaultRoutines);
    console.log('Seeded default routines successfully.');
  }
}
