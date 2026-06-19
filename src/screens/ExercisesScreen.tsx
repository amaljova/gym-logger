import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/db';
import { uuid } from '../utils/uuid';
import { Plus, Search, Edit3, Trash2, X, Save, Dumbbell, Check } from 'lucide-react';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];

type ModalMode = 'closed' | 'create' | 'edit';

export default function ExercisesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formMuscle, setFormMuscle] = useState(MUSCLE_GROUPS[0]);

  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];
  const routines = useLiveQuery(() => db.routines.toArray()) || [];

  const filtered = exercises
    .filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = filter === 'All' || ex.muscleGroup === filter;
      return matchesSearch && matchesMuscle;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group filtered exercises by muscle group for a clean sectioned list.
  const grouped = filtered.reduce((acc, ex) => {
    (acc[ex.muscleGroup] ||= []).push(ex);
    return acc;
  }, {} as Record<string, Exercise[]>);
  const groupNames = Object.keys(grouped).sort();

  const openCreate = () => {
    setEditingId(null);
    setFormName(search.trim());
    setFormMuscle(filter !== 'All' ? filter : MUSCLE_GROUPS[0]);
    setModalMode('create');
  };

  const openEdit = (ex: Exercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormMuscle(ex.muscleGroup);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode('closed');
    setEditingId(null);
    setFormName('');
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) return;
    const now = Date.now();

    if (modalMode === 'create') {
      await db.exercises.add({
        id: uuid(),
        name,
        muscleGroup: formMuscle,
        isCustom: true,
        updatedAt: now,
      });
    } else if (editingId) {
      await db.exercises.update(editingId, { name, muscleGroup: formMuscle, updatedAt: now });
    }
    closeModal();
  };

  const handleDelete = async (ex: Exercise) => {
    // Surface how this exercise is referenced before destroying it.
    const usedInRoutines = routines.filter(r => r.exercises.some(re => re.exerciseId === ex.id));
    const loggedSets = await db.sets.filter(s => s.exerciseId === ex.id).count();

    let msg = `Delete "${ex.name}"?`;
    const notes: string[] = [];
    if (usedInRoutines.length) notes.push(`• used in ${usedInRoutines.length} routine(s) — it will be removed from them`);
    if (loggedSets) notes.push(`• ${loggedSets} logged set(s) in history will be kept but shown as "Unknown exercise"`);
    if (notes.length) msg += '\n\n' + notes.join('\n');

    if (!confirm(msg)) return;

    const now = Date.now();
    // Remove the exercise from any routine that references it.
    for (const r of usedInRoutines) {
      await db.routines.update(r.id, {
        exercises: r.exercises.filter(re => re.exerciseId !== ex.id),
        updatedAt: now,
      });
    }
    await db.exercises.delete(ex.id);
  };

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header">
        <h1 className="screen-title">Exercises</h1>
        <p className="screen-subtitle">{exercises.length} in your library</p>
      </div>

      {/* Search */}
      <div className="search-wrapper">
        <input
          type="text"
          className="input-text"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '40px' }}
        />
        <Search size={17} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
      </div>

      {/* Muscle filter */}
      <div style={styles.filterRow}>
        {['All', ...MUSCLE_GROUPS].map(m => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            style={{
              ...styles.filterTag,
              backgroundColor: filter === m ? 'var(--accent-bg)' : 'transparent',
              borderColor: filter === m ? 'var(--accent)' : 'var(--border-color)',
              color: filter === m ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Create button */}
      <button className="btn btn-primary w-full" onClick={openCreate} style={{ marginBottom: '18px', height: '48px' }}>
        <Plus size={18} /> New exercise
      </button>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '50px 20px' }}>
          <Dumbbell size={40} />
          <p style={{ marginTop: '8px' }}>
            No exercises found.
            {search.trim() && <><br />Create "{search.trim()}" with the button above.</>}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {groupNames.map(group => (
            <div key={group}>
              <h2 style={styles.groupLabel}>{group}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {grouped[group].map(ex => (
                  <div key={ex.id} style={styles.exerciseRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '15px', fontWeight: 500 }}>{ex.name}</span>
                      {!ex.isCustom && (
                        <span className="chip" style={{ fontSize: '9px', marginLeft: '8px', padding: '1px 7px' }}>built-in</span>
                      )}
                    </div>
                    <button onClick={() => openEdit(ex)} style={styles.iconAction} aria-label={`Edit ${ex.name}`}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(ex)} style={{ ...styles.iconAction, color: 'var(--danger)' }} aria-label={`Delete ${ex.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalMode !== 'closed' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '17px', fontWeight: 600 }}>
                {modalMode === 'create' ? 'New exercise' : 'Edit exercise'}
              </h2>
              <button onClick={closeModal} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Cable Fly"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '10px' }}>Muscle group</label>
                <div style={styles.muscleGrid}>
                  {MUSCLE_GROUPS.map(m => {
                    const active = formMuscle === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setFormMuscle(m)}
                        style={{
                          ...styles.muscleChoice,
                          backgroundColor: active ? 'var(--accent-bg)' : 'transparent',
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {active && <Check size={13} />} {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!formName.trim()} style={{ flex: 2 }}>
                <Save size={16} /> {modalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginBottom: '14px',
  },
  filterTag: {
    padding: '5px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.2s ease',
    background: 'none',
  },
  groupLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  exerciseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    backdropFilter: 'blur(12px)',
    minHeight: '52px',
  },
  iconAction: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderRadius: '8px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  muscleGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  muscleChoice: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.2s ease',
    background: 'none',
  },
};
