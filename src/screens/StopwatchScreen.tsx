import { Play, Pause, RotateCcw, Flag, Plus, Minus, Timer as TimerIcon, Watch } from 'lucide-react';
import { useTimer, fmtStopwatch, fmtTimer, PRESETS } from '../contexts/TimerContext';

const RADIUS = 120;
const CIRC = 2 * Math.PI * RADIUS;

export default function StopwatchScreen() {
  const {
    mode, switchMode,
    swRunning, elapsed, laps, swProgress, startSw, pauseSw, resetSw, addLap,
    restRunning, remaining, duration, restFinished, restProgress,
    startRest, pauseRest, resetRest, adjustDuration, setPreset,
  } = useTimer();

  const isStopwatch = mode === 'stopwatch';
  const running = isStopwatch ? swRunning : restRunning;
  const progress = isStopwatch ? swProgress : restProgress;
  const dashOffset = CIRC * (1 - progress);
  const sw = fmtStopwatch(elapsed);
  const isTimerDone = !isStopwatch && restFinished;

  const onPrimary = () => {
    if (isStopwatch) running ? pauseSw() : startSw();
    else running ? pauseRest() : startRest();
  };

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header" style={{ marginBottom: '18px' }}>
        <h1 className="screen-title">Timer</h1>
        <p className="screen-subtitle">{isStopwatch ? 'Stopwatch & laps' : 'Rest between sets'}</p>
      </div>

      {/* Mode switch — switching never stops a running timer */}
      <div className="segmented" style={{ marginBottom: '8px' }}>
        <button className={isStopwatch ? 'active' : ''} onClick={() => switchMode('stopwatch')}>
          <Watch size={15} /> Stopwatch{swRunning ? ' •' : ''}
        </button>
        <button className={!isStopwatch ? 'active' : ''} onClick={() => switchMode('timer')}>
          <TimerIcon size={15} /> Rest timer{restRunning ? ' •' : ''}
        </button>
      </div>

      {/* Dial */}
      <div className="sw-dial">
        <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: 'rotate(-90deg)' }}>
          <circle className="sw-ring-bg" cx="130" cy="130" r={RADIUS} fill="none" strokeWidth="8" />
          <circle
            className="sw-ring-fg"
            cx="130" cy="130" r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={isTimerDone ? { stroke: 'var(--danger)' } : undefined}
          />
        </svg>

        <div style={{ position: 'absolute', textAlign: 'center' }}>
          {isStopwatch ? (
            <div className="sw-time" style={{ fontSize: '46px' }}>
              {sw.main}
              <span style={{ fontSize: '22px', color: 'var(--text-secondary)' }}>.{sw.cs}</span>
            </div>
          ) : (
            <div className="sw-time" style={{ fontSize: '54px', color: isTimerDone ? 'var(--danger)' : 'var(--text-primary)' }}>
              {isTimerDone ? 'Done' : fmtTimer(remaining)}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
            {running ? 'Running' : isTimerDone ? 'Time to lift' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Rest presets / adjust (only in rest mode while paused) */}
      {!isStopwatch && !running && (
        <div style={{ marginTop: '6px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '12px' }}>
            {PRESETS.map(p => {
              const active = duration === p * 1000;
              return (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                    background: active ? 'var(--accent-bg)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {p < 60 ? `${p}s` : `${p / 60}m${p % 60 ? ` ${p % 60}s` : ''}`}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            <button className="icon-btn" onClick={() => adjustDuration(-15)} style={{ border: '1px solid var(--border-color)' }} aria-label="Minus 15 seconds">
              <Minus size={18} />
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '64px', textAlign: 'center' }}>±15 sec</span>
            <button className="icon-btn" onClick={() => adjustDuration(15)} style={{ border: '1px solid var(--border-color)' }} aria-label="Plus 15 seconds">
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="sw-controls">
        {isStopwatch ? (
          <button className="sw-fab sw-fab-secondary" onClick={running ? addLap : resetSw} aria-label={running ? 'Lap' : 'Reset'}>
            {running ? <Flag size={24} /> : <RotateCcw size={24} />}
          </button>
        ) : (
          <button className="sw-fab sw-fab-secondary" onClick={resetRest} aria-label="Reset">
            <RotateCcw size={24} />
          </button>
        )}

        <button
          className={`sw-fab ${running ? 'sw-fab-danger' : 'sw-fab-primary'}`}
          onClick={onPrimary}
          aria-label={running ? 'Pause' : 'Start'}
        >
          {running ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
        </button>

        {/* keep the control row balanced */}
        <div style={{ width: 72 }} aria-hidden />
      </div>

      {/* Laps (newest first) */}
      {isStopwatch && laps.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          {laps.slice().reverse().map((lapTime, ri) => {
            const chronoIndex = laps.length - 1 - ri;
            const prev = chronoIndex > 0 ? laps[chronoIndex - 1] : 0;
            const f = fmtStopwatch(lapTime - prev);
            return (
              <div key={chronoIndex} className="sw-lap-row">
                <span className="sw-lap-num">Lap {chronoIndex + 1}</span>
                <span className="sw-lap-time">{f.main}.{f.cs}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
