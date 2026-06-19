import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workout, type WorkoutSet } from '../db/db';
import { TrendingUp, Award, BarChart2 } from 'lucide-react';

interface DataPoint {
  date: number;
  dateStr: string;
  oneRM: number;
  topWeight: number;
}

export default function ProgressScreen() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [metric, setMetric] = useState<'1rm' | 'topWeight'>('1rm');

  // Fetch completed workouts, sorted by date asc for charting
  const workouts = useLiveQuery(() => 
    db.workouts.where('status').equals('completed').sortBy('date')
  ) || [];

  const workoutMap = new Map<string, Workout>(workouts.map(w => [w.id, w]));

  // Fetch all sets
  const allSets = useLiveQuery(() => db.sets.toArray()) || [];

  // Fetch all exercises
  const exercises = useLiveQuery(() => db.exercises.toArray()) || [];

  // Get only exercises that have completed sets in history
  const loggedExerciseIds = Array.from(
    new Set(allSets.filter(s => s.completed && workoutMap.has(s.workoutId)).map(s => s.exerciseId))
  );

  const loggedExercises = exercises.filter(ex => loggedExerciseIds.includes(ex.id));

  // Set default selected exercise once loaded
  useEffect(() => {
    if (loggedExercises.length > 0 && !selectedExerciseId) {
      setSelectedExerciseId(loggedExercises[0].id);
    }
  }, [loggedExercises, selectedExerciseId]);

  // Epley 1RM calculation: weight * (1 + reps / 30)
  const calculate1RM = (weight: number, reps: number): number => {
    if (reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  };

  // Build chart data for selected exercise
  const chartData: DataPoint[] = [];

  if (selectedExerciseId) {
    // Group sets by workout
    const setsForEx = allSets.filter(s => s.exerciseId === selectedExerciseId && s.completed);
    
    // Group sets by workout date
    const workoutGroups = new Map<string, WorkoutSet[]>();
    for (const set of setsForEx) {
      const workout = workoutMap.get(set.workoutId);
      if (workout) {
        if (!workoutGroups.has(workout.id)) {
          workoutGroups.set(workout.id, []);
        }
        workoutGroups.get(workout.id)!.push(set);
      }
    }

    // Calculate max 1RM and top weight per workout
    for (const [workoutId, sets] of workoutGroups.entries()) {
      const workout = workoutMap.get(workoutId)!;
      let max1RM = 0;
      let maxWeight = 0;

      for (const set of sets) {
        const oneRM = calculate1RM(set.weight, set.reps);
        if (oneRM > max1RM) max1RM = oneRM;
        if (set.weight > maxWeight) maxWeight = set.weight;
      }

      chartData.push({
        date: workout.date,
        dateStr: new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        oneRM: Math.round(max1RM * 10) / 10,
        topWeight: maxWeight,
      });
    }

    // Sort chart data by date asc
    chartData.sort((a, b) => a.date - b.date);
  }

  // Find overall personal records
  const personalRecords = chartData.reduce(
    (acc, dp) => {
      if (dp.oneRM > acc.max1RM) acc.max1RM = dp.oneRM;
      if (dp.topWeight > acc.maxTopWeight) acc.maxTopWeight = dp.topWeight;
      return acc;
    },
    { max1RM: 0, maxTopWeight: 0 }
  );

  // SVG Chart Dimensions
  const width = 400;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 32;

  // Generate chart paths/points
  const points: { x: number; y: number; val: number; dateStr: string }[] = [];
  let pathD = '';
  let areaD = '';

  if (chartData.length > 0) {
    const values = chartData.map(d => metric === '1rm' ? d.oneRM : d.topWeight);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    // Add margin to Y-axis range
    const yMin = Math.max(0, minVal - (maxVal - minVal) * 0.1 - 5);
    const yMax = maxVal + (maxVal - minVal) * 0.1 + 5;
    const yRange = yMax - yMin || 10;

    const xMin = 0;
    const xMax = chartData.length - 1;
    const xRange = xMax - xMin || 1;

    chartData.forEach((d, i) => {
      const val = metric === '1rm' ? d.oneRM : d.topWeight;
      const x = paddingLeft + (i / xRange) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - ((val - yMin) / yRange) * (height - paddingTop - paddingBottom);
      
      points.push({ x, y, val, dateStr: d.dateStr });
    });

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }

      areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header">
        <h1 className="screen-title">Progress</h1>
        <p className="screen-subtitle">track your strength gains over time</p>
      </div>

      {loggedExercises.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={40} />
          <p style={{ marginTop: '8px' }}>No workout data to chart yet.<br />Complete some sets in your workout to generate history.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Selector */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Select Exercise</label>
            <select 
              value={selectedExerciseId} 
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="input-text"
              style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
            >
              {loggedExercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          {/* Metric Toggle */}
          <div style={styles.tabToggle}>
            <button 
              onClick={() => setMetric('1rm')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: metric === '1rm' ? 'var(--bg-card)' : 'transparent',
                color: metric === '1rm' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              Estimated 1RM
            </button>
            <button 
              onClick={() => setMetric('topWeight')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: metric === 'topWeight' ? 'var(--bg-card)' : 'transparent',
                color: metric === 'topWeight' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              Top Set Weight
            </button>
          </div>

          {/* Personal Record Cards */}
          <div style={styles.prContainer}>
            <div className="card" style={{ flex: 1, margin: 0, padding: '12px', textAlign: 'center' }}>
              <div style={styles.prHeader}>
                <Award size={14} className="text-accent" />
                <span style={styles.prLabel}>All-Time 1RM</span>
              </div>
              <span style={styles.prValue}>{personalRecords.max1RM} kg</span>
            </div>
            <div className="card" style={{ flex: 1, margin: 0, padding: '12px', textAlign: 'center' }}>
              <div style={styles.prHeader}>
                <BarChart2 size={14} className="text-accent" />
                <span style={styles.prLabel}>All-Time Top Set</span>
              </div>
              <span style={styles.prValue}>{personalRecords.maxTopWeight} kg</span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="card" style={{ padding: '12px', overflow: 'hidden' }}>
            {chartData.length < 2 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
                Need at least 2 distinct workout sessions for this exercise to draw chart lines.
              </div>
            ) : (
              <div>
                <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line 
                    x1={paddingLeft} 
                    y1={paddingTop} 
                    x2={width - paddingRight} 
                    y2={paddingTop} 
                    stroke="var(--border-color)" 
                    strokeDasharray="2,2" 
                  />
                  <line 
                    x1={paddingLeft} 
                    y1={(height - paddingBottom - paddingTop) / 2 + paddingTop} 
                    x2={width - paddingRight} 
                    y2={(height - paddingBottom - paddingTop) / 2 + paddingTop} 
                    stroke="var(--border-color)" 
                    strokeDasharray="2,2" 
                  />
                  <line 
                    x1={paddingLeft} 
                    y1={height - paddingBottom} 
                    x2={width - paddingRight} 
                    y2={height - paddingBottom} 
                    stroke="var(--border-color)" 
                  />

                  {/* Shaded Area */}
                  {areaD && <path d={areaD} fill="url(#chartGradient)" />}

                  {/* Line Path */}
                  {pathD && (
                    <path 
                      d={pathD} 
                      fill="none" 
                      stroke="var(--accent)" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  )}

                  {/* Dots & Labels */}
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="4" 
                        fill="var(--bg-dark)" 
                        stroke="var(--accent)" 
                        strokeWidth="2" 
                      />
                      
                      {/* Value Tag above dot (for endpoints or alternates) */}
                      {(idx === 0 || idx === points.length - 1 || points.length <= 5) && (
                        <text 
                          x={p.x} 
                          y={p.y - 8} 
                          fill="var(--text-primary)" 
                          fontSize="9" 
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                        >
                          {p.val}
                        </text>
                      )}

                      {/* X-axis date strings */}
                      {(idx === 0 || idx === points.length - 1 || (points.length > 2 && idx === Math.floor(points.length / 2))) && (
                        <text 
                          x={p.x} 
                          y={height - 12} 
                          fill="var(--text-secondary)" 
                          fontSize="9" 
                          textAnchor="middle"
                        >
                          {p.dateStr}
                        </text>
                      )}
                    </g>
                  ))}
                  
                  {/* Y Axis Bounds */}
                  {points.length > 0 && (
                    <g>
                      <text 
                        x={paddingLeft - 8} 
                        y={paddingTop + 4} 
                        fill="var(--text-muted)" 
                        fontSize="9" 
                        textAnchor="end"
                        fontFamily="var(--font-mono)"
                      >
                        {Math.round(Math.max(...points.map(p => p.val)))}
                      </text>
                      <text 
                        x={paddingLeft - 8} 
                        y={height - paddingBottom + 4} 
                        fill="var(--text-muted)" 
                        fontSize="9" 
                        textAnchor="end"
                        fontFamily="var(--font-mono)"
                      >
                        {Math.round(Math.min(...points.map(p => p.val)))}
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  tabToggle: {
    display: 'flex',
    backgroundColor: '#1a1a20',
    borderRadius: '8px',
    padding: '3px',
    border: '1px solid var(--border-color)',
  },
  toggleBtn: {
    flex: 1,
    border: 'none',
    borderRadius: '6px',
    padding: '8px 0',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  prContainer: {
    display: 'flex',
    gap: '12px',
  },
  prHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '4px',
  },
  prLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  prValue: {
    fontSize: '18px',
    fontWeight: '600',
  }
};
