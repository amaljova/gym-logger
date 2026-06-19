import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkoutCalendarProps {
  /** epoch-ms timestamps of completed workouts */
  workoutDates: number[];
  selectedDay: number | null; // start-of-day ms, or null
  onSelectDay: (dayMs: number | null) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Monday-based start of week for the given date.
const startOfWeek = (ms: number) => {
  const d = new Date(startOfDay(ms));
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d.getTime();
};

export default function WorkoutCalendar({ workoutDates, selectedDay, onSelectDay }: WorkoutCalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  // Count workouts per day key for quick lookup.
  const dayCounts = new Map<number, number>();
  for (const ms of workoutDates) {
    const k = startOfDay(ms);
    dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
  }

  const todayKey = startOfDay(Date.now());
  const weekStart = startOfWeek(Date.now());

  // Sessions in the displayed month and in the current (real) week.
  let monthCount = 0;
  let weekCount = 0;
  for (const ms of workoutDates) {
    const d = new Date(ms);
    if (d.getFullYear() === view.year && d.getMonth() === view.month) monthCount++;
    const k = startOfDay(ms);
    if (k >= weekStart && k < weekStart + 7 * 86400000) weekCount++;
  }

  const firstOfMonth = new Date(view.year, view.month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-based offset
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const changeMonth = (delta: number) => {
    setView(v => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  };

  return (
    <div className="card" style={{ padding: '16px 18px 18px', maxWidth: '340px', width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => changeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>{MONTHS[view.month]} {view.year}</span>
        <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => changeMonth(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday labels */}
      <div style={styles.grid}>
        {WEEKDAYS.map(w => (
          <div key={w} style={styles.weekday}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const key = new Date(view.year, view.month, day).setHours(0, 0, 0, 0);
          const has = dayCounts.has(key);
          const isToday = key === todayKey;
          const isSelected = selectedDay === key;
          return (
            <button
              key={key}
              onClick={() => has && onSelectDay(isSelected ? null : key)}
              style={{
                ...styles.day,
                cursor: has ? 'pointer' : 'default',
                backgroundColor: isSelected ? 'var(--accent)' : has ? 'var(--accent-bg)' : 'transparent',
                color: isSelected ? 'var(--on-accent)'
                  : has ? 'var(--accent)'
                  : 'var(--text-secondary)',
                fontWeight: has ? 700 : 400,
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
              }}
              aria-label={`${MONTHS[view.month]} ${day}${has ? ', workout logged' : ''}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Counts */}
      <div style={styles.counts}>
        <div style={styles.countBox}>
          <span style={styles.countVal}>{monthCount}</span>
          <span style={styles.countLbl}>{MONTHS[view.month].slice(0, 3)} sessions</span>
        </div>
        <div style={styles.countBox}>
          <span style={styles.countVal}>{weekCount}</span>
          <span style={styles.countLbl}>This week</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  weekday: {
    textAlign: 'center' as const,
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    paddingBottom: '6px',
  },
  day: {
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    borderRadius: '9px',
    background: 'transparent',
    fontFamily: 'var(--font-sans)',
    transition: 'background-color 0.15s ease',
  },
  counts: {
    display: 'flex',
    gap: '10px',
    marginTop: '14px',
  },
  countBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '10px',
    borderRadius: '10px',
    backgroundColor: 'var(--hairline)',
    border: '1px solid var(--border-color)',
  },
  countVal: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  countLbl: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
};
