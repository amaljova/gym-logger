import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Routine, type RoutineExercise, type Exercise } from '../db/db';
import {
  Plus, Trash2, Edit3, X, Search, ChevronDown, ChevronUp,
  ClipboardList, Minus, Save, Dumbbell, GripVertical
} from 'lucide-react';
import { uuid } from '../utils/uuid';
import { getMuscleGroups } from '../utils/muscleGroups';
import { sortRoutines, isShownOnTrain, persistRoutineOrder } from '../utils/routineOrder';
import SortableList from '../components/SortableList';

type ModalMode = 'closed' | 'create' | 'edit';

interface RoutineFormState {
  name: string;
  dayLabel: string;
  exercises: RoutineExercise[];
}

const emptyForm: RoutineFormState = { name: '', dayLabel: '', exercises: [] };

interface RoutinesScreenProps {
  onManageExercises?: () => void;
}

export default function RoutinesScreen({ onManageExercises }: RoutinesScreenProps) {
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [form, setForm] = useState<RoutineFormState>(emptyForm);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');

  const routines = useLiveQuery(() => db.routines.toArray()) || [];
  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];

  const exerciseMap = new Map<string, Exercise>(exercises.map(e => [e.id, e]));

  const muscleGroups = ['All', ...getMuscleGroups(exercises)];

  // ---------- Handlers ----------

  const openCreate = () => {
    setForm(emptyForm);
    setEditingRoutineId(null);
    setModalMode('create');
  };

  const openEdit = (routine: Routine) => {
    setForm({
      name: routine.name,
      dayLabel: routine.dayLabel || '',
      exercises: [...routine.exercises],
    });
    setEditingRoutineId(routine.id);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode('closed');
    setEditingRoutineId(null);
    setForm(emptyForm);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const now = Date.now();

    if (modalMode === 'create') {
      const newRoutine: Routine = {
        id: uuid(),
        name: form.name.trim(),
        dayLabel: form.dayLabel.trim() || undefined,
        exercises: form.exercises,
        updatedAt: now,
      };
      await db.routines.add(newRoutine);
    } else if (modalMode === 'edit' && editingRoutineId) {
      await db.routines.update(editingRoutineId, {
        name: form.name.trim(),
        dayLabel: form.dayLabel.trim() || undefined,
        exercises: form.exercises,
        updatedAt: now,
      });
    }

    closeModal();
  };

  const handleDelete = async (routineId: string) => {
    if (confirm('Delete this routine? This cannot be undone.')) {
      await db.routines.delete(routineId);
      if (expandedRoutineId === routineId) {
        setExpandedRoutineId(null);
      }
    }
  };

  // Toggle whether a routine is pinned to the Train page.
  const handleToggleShow = async (routine: Routine, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.routines.update(routine.id, { showOnTrain: !isShownOnTrain(routine), updatedAt: Date.now() });
  };

  const sortedRoutines = sortRoutines(routines);

  // ---- Exercise management within form ----

  const addExerciseToForm = (exerciseId: string) => {
    if (form.exercises.some(e => e.exerciseId === exerciseId)) return;
    setForm(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { exerciseId, targetSets: 3, targetReps: 10, targetWeight: 20 },
      ],
    }));
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const removeExerciseFromForm = (exerciseId: string) => {
    setForm(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.exerciseId !== exerciseId),
    }));
  };

  const updateFormExercise = (exerciseId: string, updates: Partial<RoutineExercise>) => {
    setForm(prev => ({
      ...prev,
      exercises: prev.exercises.map(e =>
        e.exerciseId === exerciseId ? { ...e, ...updates } : e
      ),
    }));
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = muscleFilter === 'All' || ex.muscleGroup === muscleFilter;
    const notAlreadyAdded = !form.exercises.some(fe => fe.exerciseId === ex.id);
    return matchesSearch && matchesMuscle && notAlreadyAdded;
  });

  const pickerQuery = searchQuery.trim();
  const pickerExactExists = exercises.some(ex => ex.name.toLowerCase() === pickerQuery.toLowerCase());

  // Create a brand-new exercise from the picker and add it to the routine form.
  const handleCreateExerciseForForm = async () => {
    if (!pickerQuery) return;
    const id = uuid();
    await db.exercises.add({
      id,
      name: pickerQuery,
      muscleGroup: muscleFilter !== 'All' ? muscleFilter : 'Other',
      isCustom: true,
      updatedAt: Date.now(),
    });
    addExerciseToForm(id);
  };

  // ---------- Render ----------

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header" style={{ marginBottom: '18px' }}>
        <h1 className="screen-title">Routines</h1>
        <p className="screen-subtitle">build and manage your workout templates</p>
      </div>

      {/* Create Button */}
      <button
        className="btn btn-primary w-full"
        onClick={openCreate}
        style={{ marginBottom: '10px', height: '50px', fontSize: '15px' }}
      >
        <Plus size={20} />
        Create new routine
      </button>

      {onManageExercises && (
        <button
          className="btn btn-secondary w-full"
          onClick={onManageExercises}
          style={{ marginBottom: '20px', height: '44px', minHeight: '44px', fontSize: '14px' }}
        >
          <Dumbbell size={16} />
          Manage exercise library
        </button>
      )}

      {/* Routine Cards List */}
      {routines.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <ClipboardList size={40} />
          <p style={{ marginTop: '8px' }}>
            No routines yet.<br />Create one to quickly start structured workouts.
          </p>
        </div>
      ) : (
        <SortableList
          items={sortedRoutines}
          gap={12}
          onReorder={(ids) => persistRoutineOrder(ids)}
          renderItem={(routine, { dragging, handleProps }) => {
            const isExpanded = expandedRoutineId === routine.id;
            const shown = isShownOnTrain(routine);
            const musclesUsed = Array.from(
              new Set(
                routine.exercises
                  .map(re => exerciseMap.get(re.exerciseId)?.muscleGroup)
                  .filter(Boolean)
              )
            );

            return (
              <div key={routine.id} style={{
                ...cardStyles.routineCard,
                borderColor: isExpanded ? 'var(--border-focus)' : 'var(--glass-border)',
                boxShadow: dragging ? 'var(--shadow-lg)' : 'none',
                transform: dragging ? 'scale(1.01)' : 'none',
              }}>
                {/* Card Header */}
                <div
                  style={cardStyles.cardHeader}
                  onClick={() => setExpandedRoutineId(isExpanded ? null : routine.id)}
                >
                  <button {...handleProps} className="drag-handle" aria-label="Drag to reorder">
                    <GripVertical size={18} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>{routine.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' as const }}>
                      {routine.dayLabel && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {routine.dayLabel}
                        </span>
                      )}
                      <span className="chip" style={{ fontSize: '10px', padding: '2px 7px' }}>
                        {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <button
                      className={`toggle-switch${shown ? ' on' : ''}`}
                      onClick={(e) => handleToggleShow(routine, e)}
                      role="switch"
                      aria-checked={shown}
                      aria-label="Show on Train page"
                      title={shown ? 'Shown on Train page' : 'Hidden from Train page'}
                    >
                      <span className="knob" />
                    </button>
                    {isExpanded
                      ? <ChevronUp size={18} className="text-secondary" />
                      : <ChevronDown size={18} className="text-secondary" />}
                  </div>
                </div>

                {/* Expanded Body */}
                {isExpanded && (
                  <div style={cardStyles.cardBody}>
                    {/* Muscle groups used */}
                    {musclesUsed.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: '12px' }}>
                        {musclesUsed.map(mg => (
                          <span key={mg} className="chip chip-accent" style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {mg}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Exercise list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {routine.exercises.map((re, idx) => {
                        const ex = exerciseMap.get(re.exerciseId);
                        return (
                          <div key={re.exerciseId} style={cardStyles.exerciseRow}>
                            <span style={cardStyles.exerciseNum}>{idx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                {ex?.name || 'Unknown'}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                {re.targetSets}×{re.targetReps} @ {re.targetWeight}kg
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {routine.exercises.length === 0 && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                          No exercises in this routine
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEdit(routine)}
                        style={{ flex: 1, minHeight: '40px', height: '40px' }}
                      >
                        <Edit3 size={15} /> Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(routine.id)}
                        style={{ minHeight: '40px', height: '40px', padding: '0 14px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {modalMode !== 'closed' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '92vh' }}
          >
            <div className="modal-header" style={{ position: 'relative' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                {modalMode === 'create' ? 'New routine' : 'Edit routine'}
              </h2>
              <button onClick={closeModal} style={cardStyles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Routine name</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Push Day"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Day Label */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description (optional)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Chest, Shoulders & Triceps"
                  value={form.dayLabel}
                  onChange={e => setForm(prev => ({ ...prev, dayLabel: e.target.value }))}
                />
              </div>

              {/* Exercises in form */}
              <div>
                <label className="form-label" style={{ marginBottom: '10px' }}>Exercises</label>

                {form.exercises.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '10px',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}>
                    <Dumbbell size={24} style={{ marginBottom: '6px', opacity: 0.5 }} />
                    <p>No exercises added yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.exercises.map((re, idx) => {
                      const ex = exerciseMap.get(re.exerciseId);
                      return (
                        <div key={re.exerciseId} style={cardStyles.formExCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <span style={cardStyles.exerciseNum}>{idx + 1}</span>
                              <span style={{ fontWeight: '500', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {ex?.name || 'Unknown'}
                              </span>
                              <span className="chip" style={{ fontSize: '9px', padding: '1px 6px', flexShrink: 0 }}>{ex?.muscleGroup}</span>
                            </div>
                            <button
                              onClick={() => removeExerciseFromForm(re.exerciseId)}
                              style={cardStyles.removeExBtn}
                              aria-label="Remove exercise"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Sets / Reps / Weight steppers */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {/* Sets */}
                            <div style={cardStyles.stepperGroup}>
                              <span style={cardStyles.stepperLabel}>Sets</span>
                              <div style={cardStyles.stepperRow}>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetSets: Math.max(1, re.targetSets - 1) })}
                                  style={cardStyles.stepperBtn}
                                ><Minus size={12} /></button>
                                <span style={cardStyles.stepperVal}>{re.targetSets}</span>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetSets: re.targetSets + 1 })}
                                  style={cardStyles.stepperBtn}
                                ><Plus size={12} /></button>
                              </div>
                            </div>

                            {/* Reps */}
                            <div style={cardStyles.stepperGroup}>
                              <span style={cardStyles.stepperLabel}>Reps</span>
                              <div style={cardStyles.stepperRow}>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetReps: Math.max(1, re.targetReps - 1) })}
                                  style={cardStyles.stepperBtn}
                                ><Minus size={12} /></button>
                                <span style={cardStyles.stepperVal}>{re.targetReps}</span>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetReps: re.targetReps + 1 })}
                                  style={cardStyles.stepperBtn}
                                ><Plus size={12} /></button>
                              </div>
                            </div>

                            {/* Weight */}
                            <div style={cardStyles.stepperGroup}>
                              <span style={cardStyles.stepperLabel}>Kg</span>
                              <div style={cardStyles.stepperRow}>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetWeight: Math.max(0, re.targetWeight - 2.5) })}
                                  style={cardStyles.stepperBtn}
                                ><Minus size={12} /></button>
                                <span style={cardStyles.stepperVal}>{re.targetWeight}</span>
                                <button
                                  onClick={() => updateFormExercise(re.exerciseId, { targetWeight: re.targetWeight + 2.5 })}
                                  style={cardStyles.stepperBtn}
                                ><Plus size={12} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add exercise button */}
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => { setShowExercisePicker(true); setSearchQuery(''); setMuscleFilter('All'); }}
                  style={{ marginTop: '10px', borderStyle: 'dashed', height: '44px', minHeight: '44px' }}
                >
                  <Plus size={16} /> Add exercise
                </button>
              </div>
            </div>

            {/* Footer Save */}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!form.name.trim()}
                style={{ flex: 2 }}
              >
                <Save size={16} />
                {modalMode === 'create' ? 'Create routine' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EXERCISE PICKER SUB-MODAL ==================== */}
      {showExercisePicker && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={() => setShowExercisePicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'relative' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Select exercise</h2>
              <button onClick={() => setShowExercisePicker(false)} style={cardStyles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Search */}
              <div className="search-wrapper">
                <input
                  type="text"
                  className="input-text"
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-secondary)' }} />
              </div>

              {/* Muscle filter */}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: '14px' }}>
                {muscleGroups.map(mg => (
                  <button
                    key={mg}
                    onClick={() => setMuscleFilter(mg)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      border: '1px solid',
                      transition: 'all 0.2s ease',
                      backgroundColor: muscleFilter === mg ? 'var(--accent-bg)' : 'var(--bg-card-solid)',
                      borderColor: muscleFilter === mg ? 'var(--accent)' : 'var(--border-color)',
                      color: muscleFilter === mg ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {mg}
                  </button>
                ))}
              </div>

              {/* Exercise list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
                {filteredExercises.map(ex => (
                  <div
                    key={ex.id}
                    onClick={() => addExerciseToForm(ex.id)}
                    style={cardStyles.pickerRow}
                  >
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{ex.name}</span>
                    <span className="chip" style={{ fontSize: '10px', padding: '2px 8px' }}>{ex.muscleGroup}</span>
                  </div>
                ))}

                {pickerQuery && !pickerExactExists && (
                  <button onClick={handleCreateExerciseForForm} style={cardStyles.createRow}>
                    <Plus size={16} />
                    <span>Create "<strong>{pickerQuery}</strong>"</span>
                  </button>
                )}

                {filteredExercises.length === 0 && !pickerQuery && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
                    Search to find or create an exercise.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Styles =====================

const cardStyles = {
  routineCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--glass-border)',
    borderRadius: '14px',
    overflow: 'hidden' as const,
    transition: 'border-color 0.25s ease',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  cardHeader: {
    padding: '16px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none' as const,
  },
  cardBody: {
    padding: '0 16px 16px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '14px',
  },
  exerciseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    backgroundColor: 'var(--hairline)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  exerciseNum: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--accent-gradient-subtle)',
    border: '1px solid var(--accent-border)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: '11px',
    fontWeight: '700' as const,
    color: 'var(--accent)',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex' as const,
    alignItems: 'center' as const,
  },
  formExCard: {
    padding: '12px',
    backgroundColor: 'var(--hairline)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
  },
  removeExBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: '4px',
    transition: 'color 0.2s ease',
  },
  stepperGroup: {
    flex: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: '4px',
  },
  stepperLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: '600' as const,
  },
  stepperRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '2px',
  },
  stepperBtn: {
    width: '26px',
    height: '26px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'var(--bg-card-solid)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  stepperVal: {
    minWidth: '32px',
    textAlign: 'center' as const,
    fontSize: '14px',
    fontWeight: '600' as const,
    fontFamily: 'var(--font-mono)',
  },
  pickerRow: {
    padding: '12px',
    backgroundColor: 'var(--hairline)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
  },
  createRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    padding: '12px',
    width: '100%',
    backgroundColor: 'var(--accent-bg)',
    border: '1px dashed var(--accent-border)',
    borderRadius: '10px',
    color: 'var(--accent)',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
};
