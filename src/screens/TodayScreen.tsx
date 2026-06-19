import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workout, type WorkoutSet, type Exercise, type Routine, type SetType } from '../db/db';
import {
  Plus, Minus, Check, ChevronDown, ChevronUp, Trash2,
  Dumbbell, Play, PlusCircle, Save, X, Search, MessageSquare, GripVertical
} from 'lucide-react';
import { uuid } from '../utils/uuid';
import { getMuscleGroups } from '../utils/muscleGroups';
import { sortRoutines, isShownOnTrain, mergeVisibleOrder, persistRoutineOrder } from '../utils/routineOrder';
import SortableList from '../components/SortableList';
import { useTimer } from '../contexts/TimerContext';

// Visual styling per set type. `normal` shows the plain set number.
const SET_TYPE_META: Record<Exclude<SetType, 'normal'>, { label: string; color: string; bg: string }> = {
  warmup: { label: 'W', color: 'var(--type-warmup)', bg: 'var(--type-warmup-bg)' },
  drop: { label: 'D', color: 'var(--type-drop)', bg: 'var(--type-drop-bg)' },
  failure: { label: 'F', color: 'var(--type-failure)', bg: 'var(--type-failure-bg)' },
};

interface TodayScreenProps {
  onNavigateToRoutines?: () => void;
}

export default function TodayScreen({ onNavigateToRoutines }: TodayScreenProps) {
  const { autoStartOnSet, restartStopwatch } = useTimer();
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>('All');
  const [lastRecords, setLastRecords] = useState<Record<string, string>>({});
  const [prevSetsMap, setPrevSetsMap] = useState<Record<string, WorkoutSet[]>>({});
  // animation tracking
  const [newSetIds, setNewSetIds] = useState<Set<string>>(new Set());
  const [completedAnimIds, setCompletedAnimIds] = useState<Set<string>>(new Set());
  // notes per exercise
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const noteDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const liveActiveWorkout = useLiveQuery(
    () => db.workouts.filter(w => w.status === 'active').first()
  );

  useEffect(() => {
    if (liveActiveWorkout) {
      setActiveWorkout(liveActiveWorkout);
    } else {
      setActiveWorkout(null);
    }
  }, [liveActiveWorkout]);

  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];
  const routines = useLiveQuery(() => db.routines.toArray()) || [];
  // Most recent completed sessions — used to highlight the next routine due.
  const recentCompleted = useLiveQuery(
    () => db.workouts.where('status').equals('completed').reverse().sortBy('date')
  ) || [];

  // Routines shown on the Train page, in manual order.
  const trainRoutines = sortRoutines(routines.filter(isShownOnTrain));

  // "Workout of the day" = the routine after the last completed routine session.
  let todaysRoutineId: string | undefined;
  if (trainRoutines.length > 0) {
    const lastRoutineId = recentCompleted.find(w => w.routineId)?.routineId;
    if (lastRoutineId) {
      const idx = trainRoutines.findIndex(r => r.id === lastRoutineId);
      todaysRoutineId = idx === -1 ? trainRoutines[0].id : trainRoutines[(idx + 1) % trainRoutines.length].id;
    } else {
      todaysRoutineId = trainRoutines[0].id;
    }
  }

  const handleTrainReorder = (visibleIds: string[]) => {
    persistRoutineOrder(mergeVisibleOrder(sortRoutines(routines), visibleIds));
  };

  const liveWorkoutId = liveActiveWorkout?.id;
  const activeSets = useLiveQuery(
    () => liveWorkoutId
      ? db.sets.where('workoutId').equals(liveWorkoutId).toArray()
      : Promise.resolve([] as WorkoutSet[]),
    [liveWorkoutId]
  ) || [];

  const uniqueExerciseIds = Array.from(new Set(activeSets.map(s => s.exerciseId)));
  const workoutExercises = exercises.filter(ex => uniqueExerciseIds.includes(ex.id));

  useEffect(() => {
    if (workoutExercises.length > 0 && !expandedExerciseId) {
      setExpandedExerciseId(workoutExercises[0].id);
    }
  }, [workoutExercises, expandedExerciseId]);

  // Load notes from DB when workout changes
  useEffect(() => {
    if (!activeWorkout) {
      setExerciseNotes({});
      return;
    }
    db.workoutNotes.where('workoutId').equals(activeWorkout.id).toArray().then(notes => {
      const map: Record<string, string> = {};
      notes.forEach(n => { map[n.exerciseId] = n.note; });
      setExerciseNotes(map);
    });
  }, [activeWorkout?.id]);

  // Save note to DB (debounced 600ms)
  const handleNoteChange = useCallback(async (exerciseId: string, note: string) => {
    setExerciseNotes(prev => ({ ...prev, [exerciseId]: note }));
    if (!activeWorkout) return;

    clearTimeout(noteDebounceRef.current[exerciseId]);
    noteDebounceRef.current[exerciseId] = setTimeout(async () => {
      const existing = await db.workoutNotes
        .where('workoutId').equals(activeWorkout.id)
        .filter(n => n.exerciseId === exerciseId)
        .first();
      if (existing) {
        await db.workoutNotes.update(existing.id, { note, updatedAt: Date.now() });
      } else {
        await db.workoutNotes.add({
          id: uuid(),
          workoutId: activeWorkout.id,
          exerciseId,
          note,
          updatedAt: Date.now(),
        });
      }
    }, 600);
  }, [activeWorkout]);

  useEffect(() => {
    if (!activeWorkout || uniqueExerciseIds.length === 0) return;

    async function loadLastPerformances() {
      const records: Record<string, string> = {};
      const prevSets: Record<string, WorkoutSet[]> = {};

      for (const exId of uniqueExerciseIds) {
        const completedWorkouts = await db.workouts
          .where('status').equals('completed').reverse().sortBy('date');

        let foundSets: WorkoutSet[] = [];
        for (const w of completedWorkouts) {
          const sets = await db.sets
            .where('workoutId').equals(w.id)
            .filter(s => s.exerciseId === exId && s.completed)
            .toArray();
          if (sets.length > 0) {
            foundSets = sets.sort((a, b) => a.setNumber - b.setNumber);
            break;
          }
        }

        if (foundSets.length > 0) {
          prevSets[exId] = foundSets;
          const summary = foundSets.map(s => `${s.weight}kg×${s.reps}`).join(', ');
          records[exId] = `Last: ${summary}`;
        }
      }
      setLastRecords(records);
      setPrevSetsMap(prevSets);
    }

    loadLastPerformances();
  }, [activeWorkout, activeSets.length, uniqueExerciseIds.join(',')]);

  const exercisesCount = uniqueExerciseIds.length;
  const completedSetsCount = activeSets.filter(s => s.completed).length;
  const totalSetsCount = activeSets.length;
  // Warm-up sets are excluded from working volume (standard convention).
  const totalVolume = activeSets
    .filter(s => s.completed && s.setType !== 'warmup')
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
  const progressPct = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  const handleStartFreestyle = async () => {
    const now = Date.now();
    const workoutId = uuid();
    const newWorkout: Workout = { id: workoutId, date: now, status: 'active', updatedAt: now };
    await db.workouts.add(newWorkout);
    setActiveWorkout(newWorkout);
  };

  const handleStartRoutine = async (routine: Routine) => {
    const now = Date.now();
    const workoutId = uuid();
    const newWorkout: Workout = { id: workoutId, date: now, routineId: routine.id, status: 'active', updatedAt: now };
    await db.workouts.add(newWorkout);

    const completedWorkouts = await db.workouts
      .where('status').equals('completed').reverse().sortBy('date');

    for (const re of routine.exercises) {
      // Find the most recent completed session that included this exercise.
      let foundSets: WorkoutSet[] = [];
      for (const w of completedWorkouts) {
        const sets = await db.sets
          .where('workoutId').equals(w.id)
          .filter(s => s.exerciseId === re.exerciseId && s.completed)
          .toArray();
        if (sets.length > 0) {
          foundSets = sets.sort((a, b) => a.setNumber - b.setNumber);
          break;
        }
      }

      // Prefill from last time: set COUNT, weight, and reps. Fall back to the
      // routine's targets only when this exercise has never been logged.
      const setCount = foundSets.length > 0 ? foundSets.length : re.targetSets;
      for (let i = 1; i <= setCount; i++) {
        let weight = re.targetWeight;
        let reps = re.targetReps;
        if (foundSets.length > 0) {
          const match = foundSets[i - 1] || foundSets[foundSets.length - 1];
          weight = match.weight;
          reps = match.reps;
        }
        await db.sets.add({
          id: uuid(),
          workoutId,
          exerciseId: re.exerciseId,
          setNumber: i,
          weight,
          reps,
          completed: false,
          updatedAt: now,
        });
      }
    }

    setActiveWorkout(newWorkout);
    if (routine.exercises.length > 0) setExpandedExerciseId(routine.exercises[0].exerciseId);
  };

  const handleAddExerciseToWorkout = async (exerciseId: string) => {
    if (!activeWorkout) return;

    const existingSets = activeSets.filter(s => s.exerciseId === exerciseId);
    if (existingSets.length > 0) {
      setExpandedExerciseId(exerciseId);
      setShowAddModal(false);
      return;
    }

    const now = Date.now();
    let weight = 20;
    let reps = 10;
    const prevSets = prevSetsMap[exerciseId] || [];
    if (prevSets.length > 0) { weight = prevSets[0].weight; reps = prevSets[0].reps; }

    const setId = uuid();
    await db.sets.add({ id: setId, workoutId: activeWorkout.id, exerciseId, setNumber: 1, weight, reps, completed: false, updatedAt: now });
    setNewSetIds(prev => new Set(prev).add(setId));
    setTimeout(() => setNewSetIds(prev => { const next = new Set(prev); next.delete(setId); return next; }), 400);

    setExpandedExerciseId(exerciseId);
    setShowAddModal(false);
  };

  const handleAddSet = async (exerciseId: string) => {
    if (!activeWorkout) return;

    const setsForEx = activeSets.filter(s => s.exerciseId === exerciseId);
    const nextSetNum = setsForEx.length + 1;
    const now = Date.now();

    let weight = 20;
    let reps = 10;
    if (setsForEx.length > 0) {
      const lastSet = setsForEx.reduce((p, c) => p.setNumber > c.setNumber ? p : c);
      weight = lastSet.weight;
      reps = lastSet.reps;
    } else {
      const prevSets = prevSetsMap[exerciseId] || [];
      if (prevSets.length > 0) { weight = prevSets[0].weight; reps = prevSets[0].reps; }
    }

    const setId = uuid();
    await db.sets.add({ id: setId, workoutId: activeWorkout.id, exerciseId, setNumber: nextSetNum, weight, reps, completed: false, updatedAt: now });
    setNewSetIds(prev => new Set(prev).add(setId));
    setTimeout(() => setNewSetIds(prev => { const next = new Set(prev); next.delete(setId); return next; }), 400);
  };

  const handleRemoveSet = async (setId: string) => {
    const setToDelete = await db.sets.get(setId);
    if (!setToDelete) return;
    await db.sets.delete(setId);

    const now = Date.now();
    const remainingSets = await db.sets
      .where('workoutId').equals(setToDelete.workoutId)
      .filter(s => s.exerciseId === setToDelete.exerciseId)
      .toArray();

    const sorted = remainingSets.sort((a, b) => a.setNumber - b.setNumber);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].setNumber !== i + 1) {
        await db.sets.update(sorted[i].id, { setNumber: i + 1, updatedAt: now });
      }
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!activeWorkout) return;
    if (confirm('Remove this exercise and all its sets?')) {
      const setsToDelete = activeSets.filter(s => s.exerciseId === exerciseId);
      for (const s of setsToDelete) await db.sets.delete(s.id);
      // Also delete notes for this exercise
      const notes = await db.workoutNotes
        .where('workoutId').equals(activeWorkout.id)
        .filter(n => n.exerciseId === exerciseId)
        .toArray();
      for (const n of notes) await db.workoutNotes.delete(n.id);
      if (expandedExerciseId === exerciseId) setExpandedExerciseId(null);
    }
  };

  const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
    await db.sets.update(setId, { ...updates, updatedAt: Date.now() });
  };

  const handleStepValue = async (setId: string, field: 'weight' | 'reps', step: number) => {
    const set = await db.sets.get(setId);
    if (!set) return;
    await db.sets.update(setId, { [field]: Math.max(0, set[field] + step), updatedAt: Date.now() });
  };

  const handleToggleComplete = async (set: WorkoutSet) => {
    const now = Date.now();
    const willComplete = !set.completed;
    await db.sets.update(set.id, { completed: willComplete, completedAt: willComplete ? now : undefined, updatedAt: now });
    if (willComplete) {
      // haptic feedback if available
      if ('vibrate' in navigator) navigator.vibrate(40);
      setCompletedAnimIds(prev => new Set(prev).add(set.id));
      setTimeout(() => setCompletedAnimIds(prev => { const next = new Set(prev); next.delete(set.id); return next; }), 600);
      // Optionally start a fresh rest stopwatch for this set.
      if (autoStartOnSet) restartStopwatch();
    }
  };

  // Tap the set-number badge to cycle: normal → warm-up → drop → failure → normal
  const handleCycleSetType = async (set: WorkoutSet) => {
    const order: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
    const current = set.setType || 'normal';
    const next = order[(order.indexOf(current) + 1) % order.length];
    if ('vibrate' in navigator) navigator.vibrate(15);
    await db.sets.update(set.id, { setType: next, updatedAt: Date.now() });
  };

  // BUG FIX: Re-fetch sets from DB to avoid stale closure
  const handleFinishWorkout = async () => {
    if (!activeWorkout) return;

    const currentSets = await db.sets.where('workoutId').equals(activeWorkout.id).toArray();
    const completedCount = currentSets.filter(s => s.completed).length;

    if (completedCount === 0) {
      alert('Log at least one completed set before ending your workout.');
      return;
    }

    if (confirm('End workout session? All completed sets will be saved.')) {
      const now = Date.now();
      const incompleteSets = currentSets.filter(s => !s.completed);
      for (const s of incompleteSets) await db.sets.delete(s.id);
      await db.workouts.update(activeWorkout.id, { status: 'completed', updatedAt: now });
      setActiveWorkout(null);
      setExpandedExerciseId(null);
    }
  };

  const handleCancelWorkout = async () => {
    if (!activeWorkout) return;
    if (confirm('Discard this workout session? All sets will be deleted.')) {
      const allSets = await db.sets.where('workoutId').equals(activeWorkout.id).toArray();
      for (const s of allSets) await db.sets.delete(s.id);
      const allNotes = await db.workoutNotes.where('workoutId').equals(activeWorkout.id).toArray();
      for (const n of allNotes) await db.workoutNotes.delete(n.id);
      await db.workouts.delete(activeWorkout.id);
      setActiveWorkout(null);
      setExpandedExerciseId(null);
    }
  };

  const handleCreateCustomExercise = async () => {
    if (!searchQuery.trim()) return;
    const now = Date.now();
    const newExId = uuid();
    const newEx: Exercise = {
      id: newExId,
      name: searchQuery.trim(),
      muscleGroup: selectedMuscleFilter === 'All' ? 'Custom' : selectedMuscleFilter,
      isCustom: true,
      updatedAt: now,
    };
    await db.exercises.add(newEx);
    await handleAddExerciseToWorkout(newExId);
    setSearchQuery('');
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscleFilter === 'All' || ex.muscleGroup === selectedMuscleFilter;
    return matchesSearch && matchesMuscle;
  });

  const muscleGroups = ['All', ...getMuscleGroups(exercises)];

  return (
    <div className="screen">
      {!activeWorkout ? (
        /* ── SETUP SCREEN (bento dashboard) ── */
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Bento dashboard */}
          <div className="bento-grid">
            {/* Greeting tile */}
            <div className="bento-tile col-span-2" style={styles.greetTile}>
              <Dumbbell size={22} style={{ color: 'var(--accent)' }} />
              <h1 style={styles.greetTitle}>Ready to train?</h1>
              <p style={styles.greetSub}>Pick a routine or start freestyle.</p>
            </div>

            {/* Freestyle CTA */}
            <button className="btn btn-primary col-span-2" onClick={handleStartFreestyle} style={{ height: '56px', fontSize: '16px', borderRadius: '16px' }}>
              <Play size={20} />
              Start freestyle session
            </button>
          </div>

          {/* Routines */}
          <div style={{ marginTop: '22px' }}>
            <div style={styles.routineHeaderRow}>
              <h2 style={styles.sectionLabel}>Routines</h2>
              {onNavigateToRoutines && (
                <button onClick={onNavigateToRoutines} style={styles.linkBtn}>
                  Manage routines →
                </button>
              )}
            </div>
            {trainRoutines.length === 0 ? (
              <div className="bento-tile text-center" style={{ padding: '24px' }}>
                <p className="text-secondary">
                  {routines.length === 0 ? 'No routines set up yet.' : 'No routines pinned to Train. Enable some in Routines.'}
                </p>
              </div>
            ) : (
              <SortableList
                items={trainRoutines}
                onReorder={handleTrainReorder}
                renderItem={(routine, { dragging, handleProps }) => {
                  const isToday = routine.id === todaysRoutineId;
                  return (
                    <div
                      key={routine.id}
                      className="bento-tile"
                      style={{
                        ...styles.routineTile,
                        borderColor: isToday ? 'var(--accent)' : 'var(--border-color)',
                        boxShadow: dragging ? 'var(--shadow-lg)' : isToday ? '0 0 0 1px var(--accent-border)' : 'none',
                        transform: dragging ? 'scale(1.02)' : 'none',
                        opacity: dragging ? 0.95 : 1,
                      }}
                    >
                      <button {...handleProps} className="drag-handle" aria-label="Drag to reorder">
                        <GripVertical size={18} />
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>{routine.name}</h3>
                          {isToday && <span className="today-badge">Today</span>}
                        </div>
                        {routine.dayLabel && (
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{routine.dayLabel}</p>
                        )}
                      </div>
                      <button
                        className={isToday ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => handleStartRoutine(routine)}
                        style={{ minHeight: '40px', padding: '0 16px', fontSize: '14px', flexShrink: 0 }}
                      >
                        <Play size={15} /> Start
                      </button>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>
      ) : (
        /* ── ACTIVE WORKOUT SCREEN ── */
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.3px' }}>
                {activeWorkout.routineId ? routines.find(r => r.id === activeWorkout.routineId)?.name || 'Routine' : 'Freestyle'}
              </h1>
              <p className="text-secondary" style={{ fontSize: '12px', marginTop: '2px' }}>
                {new Date(activeWorkout.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <button className="btn btn-danger" onClick={handleCancelWorkout} style={{ minHeight: '34px', height: '34px', padding: '0 10px', fontSize: '12px' }}>
              Discard
            </button>
          </div>

          {/* Stats Strip */}
          <div style={styles.statsStrip}>
            <div style={styles.statBox}>
              <span style={styles.statVal}>{exercisesCount}</span>
              <span style={styles.statLbl}>Exercises</span>
            </div>
            <div style={{ ...styles.statBox, flex: 2 }}>
              <span style={styles.statVal}>{completedSetsCount}<span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '400' }}>/{totalSetsCount}</span></span>
              <span style={styles.statLbl}>Sets done</span>
              <div className="progress-bar-track" style={{ width: '80%', marginTop: '6px' }}>
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statVal}>{totalVolume > 0 ? `${(totalVolume / 1000).toFixed(1)}t` : '—'}</span>
              <span style={styles.statLbl}>Volume</span>
            </div>
          </div>

          {/* Exercises List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {workoutExercises.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <Dumbbell size={40} />
                <p style={{ marginTop: '8px' }}>Workout is empty.<br />Add exercises to get started.</p>
              </div>
            ) : (
              workoutExercises.map(ex => {
                const exSets = activeSets.filter(s => s.exerciseId === ex.id).sort((a, b) => a.setNumber - b.setNumber);
                const isExpanded = expandedExerciseId === ex.id;
                const lastText = lastRecords[ex.id];
                const completedForEx = exSets.filter(s => s.completed).length;
                const note = exerciseNotes[ex.id] || '';

                return (
                  <div key={ex.id} style={{
                    ...styles.exerciseCard,
                    borderColor: isExpanded ? 'var(--accent-border)' : 'var(--border-color)',
                  }}>
                    {/* Header */}
                    <div style={styles.exerciseHeader} onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', fontSize: '15px' }}>{ex.name}</span>
                          <span className="chip" style={{ fontSize: '10px', padding: '2px 7px' }}>{ex.muscleGroup}</span>
                        </div>
                        {!isExpanded && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            {completedForEx}/{exSets.length} sets completed
                            {note && <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>· note</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {completedForEx === exSets.length && exSets.length > 0 && (
                          <div style={styles.allDoneDot} />
                        )}
                        {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={styles.exerciseBody}>
                        {/* Ghost Text */}
                        {lastText && (
                          <div style={styles.ghostText}>{lastText}</div>
                        )}

                        {/* Set Row Header */}
                        <div style={styles.setRowHeader}>
                          <span style={{ width: '10%' }}>#</span>
                          <span style={{ width: '37%', textAlign: 'center' }}>Weight (kg)</span>
                          <span style={{ width: '37%', textAlign: 'center' }}>Reps</span>
                          <span style={{ width: '16%' }}></span>
                        </div>

                        {/* Set Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          {exSets.map((set) => {
                            const isNew = newSetIds.has(set.id);
                            const isCompletedAnim = completedAnimIds.has(set.id);
                            const typeMeta = set.setType && set.setType !== 'normal' ? SET_TYPE_META[set.setType] : null;
                            return (
                              <div
                                key={set.id}
                                className={`${isNew ? 'anim-slide-in' : ''} ${isCompletedAnim ? 'anim-set-complete' : ''}`}
                                style={{
                                  ...styles.setRow,
                                  backgroundColor: set.completed ? 'var(--accent-bg)' : 'transparent',
                                  borderColor: set.completed ? 'var(--accent-border)' : 'var(--border-color)',
                                }}
                              >
                                {/* Set number — tap to cycle set type */}
                                <button
                                  onClick={() => handleCycleSetType(set)}
                                  style={{
                                    ...styles.setTypeBadge,
                                    color: typeMeta ? typeMeta.color : 'var(--text-muted)',
                                    backgroundColor: typeMeta ? typeMeta.bg : 'transparent',
                                    borderColor: typeMeta ? typeMeta.color : 'var(--border-color)',
                                  }}
                                  title={`Set type: ${set.setType || 'normal'} — tap to change`}
                                  aria-label={`Set ${set.setNumber}, type ${set.setType || 'normal'}, tap to change`}
                                >
                                  {typeMeta ? typeMeta.label : set.setNumber}
                                </button>

                                {/* Weight */}
                                <div style={styles.inputStepperCol}>
                                  <button onClick={() => handleStepValue(set.id, 'weight', -2.5)} style={styles.stepBtn} disabled={set.completed}>
                                    <Minus size={13} />
                                  </button>
                                  <input
                                    type="number"
                                    value={set.weight}
                                    onChange={(e) => handleUpdateSet(set.id, { weight: parseFloat(e.target.value) || 0 })}
                                    style={styles.setInput}
                                    disabled={set.completed}
                                  />
                                  <button onClick={() => handleStepValue(set.id, 'weight', 2.5)} style={styles.stepBtn} disabled={set.completed}>
                                    <Plus size={13} />
                                  </button>
                                </div>

                                {/* Reps */}
                                <div style={styles.inputStepperCol}>
                                  <button onClick={() => handleStepValue(set.id, 'reps', -1)} style={styles.stepBtn} disabled={set.completed}>
                                    <Minus size={13} />
                                  </button>
                                  <input
                                    type="number"
                                    value={set.reps}
                                    onChange={(e) => handleUpdateSet(set.id, { reps: parseInt(e.target.value) || 0 })}
                                    style={styles.setInput}
                                    disabled={set.completed}
                                  />
                                  <button onClick={() => handleStepValue(set.id, 'reps', 1)} style={styles.stepBtn} disabled={set.completed}>
                                    <Plus size={13} />
                                  </button>
                                </div>

                                {/* Actions */}
                                <div style={styles.setActionCol}>
                                  <button
                                    onClick={() => handleToggleComplete(set)}
                                    className={completedAnimIds.has(set.id) ? 'anim-check-pop' : ''}
                                    style={{
                                      ...styles.checkBtn,
                                      backgroundColor: set.completed ? 'var(--accent)' : 'transparent',
                                      borderColor: set.completed ? 'var(--accent)' : 'var(--border-color)',
                                      color: 'var(--on-accent)',
                                    }}
                                    aria-label="Complete set"
                                  >
                                    {set.completed && <Check size={13} strokeWidth={3} />}
                                  </button>
                                  <button onClick={() => handleRemoveSet(set.id)} style={styles.deleteSetBtn} aria-label="Delete set">
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Set-type legend */}
                        <div style={styles.typeLegend}>
                          Tap the set number to mark:
                          <span style={{ color: 'var(--type-warmup)', fontWeight: 600 }}> W</span> warm-up ·
                          <span style={{ color: 'var(--type-drop)', fontWeight: 600 }}> D</span> drop ·
                          <span style={{ color: 'var(--type-failure)', fontWeight: 600 }}> F</span> failure
                        </div>

                        {/* Notes */}
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                            <MessageSquare size={12} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '500' }}>Notes</span>
                          </div>
                          <textarea
                            className="notes-textarea"
                            placeholder="How did it feel? Any cues or adjustments for next time…"
                            value={note}
                            onChange={(e) => handleNoteChange(ex.id, e.target.value)}
                            rows={2}
                          />
                        </div>

                        {/* Exercise Footer */}
                        <div style={styles.exFooterActions}>
                          <button className="btn btn-secondary" onClick={() => handleAddSet(ex.id)} style={{ height: '40px', minHeight: '40px', flex: 1, fontSize: '14px' }}>
                            <Plus size={15} /> Add set
                          </button>
                          <button className="btn btn-danger" onClick={() => handleDeleteExercise(ex.id)} style={{ height: '40px', minHeight: '40px', padding: '0 12px' }} aria-label="Remove exercise">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Workout Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              <button className="btn btn-secondary w-full" onClick={() => setShowAddModal(true)} style={{ borderStyle: 'dashed', borderColor: 'var(--border-focus)' }}>
                <PlusCircle size={17} />
                Add exercise
              </button>
              {workoutExercises.length > 0 && (
                <button className="btn btn-primary w-full" onClick={handleFinishWorkout} style={{ height: '52px', marginTop: '4px' }}>
                  <Save size={17} />
                  Finish workout
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD EXERCISE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '17px', fontWeight: '600' }}>Add exercise</h2>
              <button onClick={() => setShowAddModal(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="search-wrapper">
                <input
                  type="text"
                  className="input-text"
                  placeholder="Search or create exercise…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  autoFocus
                />
                <Search size={17} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
              </div>

              <div style={styles.filterContainer}>
                {muscleGroups.map(muscle => (
                  <button
                    key={muscle}
                    onClick={() => setSelectedMuscleFilter(muscle)}
                    style={{
                      ...styles.filterTag,
                      backgroundColor: selectedMuscleFilter === muscle ? 'var(--accent-bg)' : 'transparent',
                      borderColor: selectedMuscleFilter === muscle ? 'var(--accent)' : 'var(--border-color)',
                      color: selectedMuscleFilter === muscle ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {muscle}
                  </button>
                ))}
              </div>

              <div style={styles.modalExList}>
                {filteredExercises.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <p className="text-secondary" style={{ marginBottom: '16px', fontSize: '14px' }}>No match found.</p>
                    {searchQuery.trim() && (
                      <button className="btn btn-primary" onClick={handleCreateCustomExercise} style={{ margin: '0 auto' }}>
                        Create "{searchQuery.trim()}"
                      </button>
                    )}
                  </div>
                ) : (
                  filteredExercises.map(ex => (
                    <div
                      key={ex.id}
                      onClick={() => handleAddExerciseToWorkout(ex.id)}
                      style={styles.modalExRow}
                    >
                      <span style={{ fontWeight: '500', fontSize: '14px' }}>{ex.name}</span>
                      <span className="chip" style={{ fontSize: '10px' }}>{ex.muscleGroup}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '10px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0',
    fontFamily: 'var(--font-sans)',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  greetTile: {
    gap: '8px',
    padding: '20px',
  },
  greetTitle: {
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '-0.4px',
    color: 'var(--text-primary)',
    marginTop: '4px',
  },
  greetSub: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  routineHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  routineTile: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    borderLeftWidth: '3px',
  },
  statsStrip: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '14px 16px',
    marginBottom: '14px',
    backdropFilter: 'blur(12px)',
  },
  statBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  statVal: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--accent)',
    lineHeight: '1.1',
  },
  statLbl: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    marginTop: '2px',
  },
  exerciseCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    overflow: 'hidden' as const,
    transition: 'border-color 0.25s ease',
    backdropFilter: 'blur(12px)',
  },
  exerciseHeader: {
    padding: '14px 16px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none' as const,
  },
  allDoneDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 0 8px var(--accent-glow)',
    flexShrink: 0,
  },
  exerciseBody: {
    padding: '0 16px 14px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '12px',
  },
  ghostText: {
    fontSize: '12px',
    fontStyle: 'italic',
    color: 'var(--text-secondary)',
    marginBottom: '10px',
    padding: '6px 10px',
    borderRadius: '7px',
    borderLeft: '2px solid var(--accent)',
    backgroundColor: 'var(--accent-bg)',
  },
  setRowHeader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    marginBottom: '6px',
    padding: '0 6px',
  },
  setRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 8px',
    borderRadius: '9px',
    border: '1px solid var(--border-color)',
    transition: 'background-color 0.25s ease, border-color 0.25s ease',
    minHeight: '44px',
  },
  typeLegend: {
    fontSize: '10.5px',
    color: 'var(--text-muted)',
    marginTop: '8px',
    lineHeight: '1.5',
  },
  setTypeBadge: {
    width: '30px',
    height: '30px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginRight: '6px',
  },
  inputStepperCol: {
    width: '37%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
  },
  setInput: {
    width: '44px',
    height: '34px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: '500',
    padding: '0',
    margin: '0',
  },
  stepBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'color 0.15s ease',
  },
  setActionCol: {
    width: '16%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
  },
  checkBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    flexShrink: 0,
  },
  deleteSetBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  exFooterActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
  },
  filterContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginBottom: '14px',
  },
  filterTag: {
    padding: '5px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.2s ease',
    background: 'none',
  },
  modalExList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '7px',
    maxHeight: '380px',
    overflowY: 'auto' as const,
  },
  modalExRow: {
    padding: '13px 14px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    minHeight: '48px',
  },
};
