import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutSet } from '../db/db';
import { Trash2, ChevronDown, ChevronUp, Calendar, MessageSquare } from 'lucide-react';

export default function HistoryScreen() {
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  const completedWorkouts = useLiveQuery(
    () => db.workouts.where('status').equals('completed').reverse().sortBy('date')
  ) || [];

  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];
  const exerciseMap = new Map(exercises.map(e => [e.id, e]));

  // Only completed sets to avoid stale incomplete sets contaminating history
  const allSets = useLiveQuery(() => db.sets.filter(s => s.completed).toArray()) || [];

  const setsByWorkout = allSets.reduce((acc, set) => {
    if (!acc[set.workoutId]) acc[set.workoutId] = [];
    acc[set.workoutId].push(set);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  const routines = useLiveQuery(() => db.routines.toArray()) || [];
  const routineMap = new Map(routines.map(r => [r.id, r]));

  // Notes per workout per exercise
  const allNotes = useLiveQuery(() => db.workoutNotes.toArray()) || [];
  const notesByWorkout = allNotes.reduce((acc, note) => {
    if (!acc[note.workoutId]) acc[note.workoutId] = {};
    acc[note.workoutId][note.exerciseId] = note.note;
    return acc;
  }, {} as Record<string, Record<string, string>>);

  const handleDeleteWorkout = async (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this workout from history? This cannot be undone.')) {
      const setsToDelete = setsByWorkout[workoutId] || [];
      for (const s of setsToDelete) await db.sets.delete(s.id);
      const notesToDelete = allNotes.filter(n => n.workoutId === workoutId);
      for (const n of notesToDelete) await db.workoutNotes.delete(n.id);
      await db.workouts.delete(workoutId);
      if (expandedWorkoutId === workoutId) setExpandedWorkoutId(null);
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header">
        <h1 className="screen-title">History</h1>
        <p className="screen-subtitle">{completedWorkouts.length} workout{completedWorkouts.length !== 1 ? 's' : ''} logged</p>
      </div>

      {completedWorkouts.length === 0 ? (
        <div className="empty-state">
          <Calendar size={40} />
          <p style={{ marginTop: '8px' }}>No workouts logged yet.<br />Complete a session to see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {completedWorkouts.map((workout) => {
            const isExpanded = expandedWorkoutId === workout.id;
            const wSets = setsByWorkout[workout.id] || [];
            const workoutNotes = notesByWorkout[workout.id] || {};

            const workoutDate = new Date(workout.date).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            });
            const routineName = workout.routineId
              ? routineMap.get(workout.routineId)?.name || 'Routine'
              : 'Freestyle';

            const uniqueExIds = Array.from(new Set(wSets.map(s => s.exerciseId)));
            const totalVolume = wSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
            const hasNotes = Object.values(workoutNotes).some(n => n && n.trim());

            return (
              <div key={workout.id} style={{
                ...styles.workoutCard,
                borderColor: isExpanded ? 'rgba(93,202,165,0.3)' : 'var(--border-color)',
              }}>
                {/* Header */}
                <div style={styles.cardHeader} onClick={() => setExpandedWorkoutId(isExpanded ? null : workout.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{routineName}</span>
                      {hasNotes && (
                        <MessageSquare size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>{workoutDate}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--accent)', display: 'block', lineHeight: '1.1' }}>
                        {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${totalVolume}kg`}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume</span>
                    </div>

                    <button onClick={(e) => handleDeleteWorkout(workout.id, e)} style={styles.deleteIconBtn} aria-label="Delete workout">
                      <Trash2 size={15} />
                    </button>

                    {isExpanded
                      ? <ChevronUp size={17} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronDown size={17} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={styles.cardBody}>
                    <div style={styles.summaryStrip}>
                      <span style={{ fontWeight: '500' }}>{uniqueExIds.length} exercise{uniqueExIds.length !== 1 ? 's' : ''}</span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontWeight: '500' }}>{wSets.length} set{wSets.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {uniqueExIds.map(exId => {
                        const ex = exerciseMap.get(exId);
                        const exSets = wSets.filter(s => s.exerciseId === exId).sort((a, b) => a.setNumber - b.setNumber);
                        const note = workoutNotes[exId];

                        return (
                          <div key={exId} style={styles.exerciseDetailRow}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontWeight: '600', fontSize: '14px' }}>{ex ? ex.name : 'Unknown exercise'}</span>
                              {ex?.muscleGroup && (
                                <span className="chip" style={{ fontSize: '10px' }}>{ex.muscleGroup}</span>
                              )}
                            </div>
                            <div style={styles.setChipsContainer}>
                              {exSets.map((s, index) => (
                                <div key={s.id} style={styles.setChip}>
                                  <span style={styles.setChipNum}>{index + 1}</span>
                                  <span style={{ fontSize: '12px' }}>{s.weight}kg × {s.reps}</span>
                                </div>
                              ))}
                            </div>
                            {note && note.trim() && (
                              <div className="note-badge" style={{ marginTop: '8px' }}>
                                <MessageSquare size={10} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.trim()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  workoutCard: {
    backgroundColor: 'rgba(16,16,20,0.7)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    overflow: 'hidden' as const,
    transition: 'border-color 0.25s ease',
    backdropFilter: 'blur(12px)',
  },
  cardHeader: {
    padding: '14px 16px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none' as const,
  },
  cardBody: {
    padding: '12px 16px 16px',
    borderTop: '1px solid var(--border-color)',
  },
  deleteIconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'color 0.2s ease',
  },
  summaryStrip: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '14px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: '7px 10px',
    borderRadius: '7px',
    border: '1px solid var(--border-color)',
  },
  exerciseDetailRow: {
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  setChipsContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  setChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-color)',
    borderRadius: '7px',
    padding: '4px 9px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  setChipNum: {
    fontSize: '10px',
    color: 'var(--accent)',
    fontWeight: '700',
    backgroundColor: 'var(--accent-bg)',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
};
