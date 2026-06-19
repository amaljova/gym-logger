import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Flag, Plus, Minus, Timer as TimerIcon, Watch } from 'lucide-react';

type Mode = 'stopwatch' | 'timer';

// ---- time formatting helpers ----
function fmtStopwatch(ms: number) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return { main: `${pad(min)}:${pad(sec)}`, cs: pad(cs) };
}

function fmtTimer(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(min)}:${pad(sec)}`;
}

// short feedback when a rest timer finishes
function finishFeedback() {
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.18);
    beep(1175, 0.22, 0.25);
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio not available — vibration/visual is enough */
  }
}

const RADIUS = 120;
const CIRC = 2 * Math.PI * RADIUS;
const PRESETS = [30, 60, 90, 120, 180]; // seconds

export default function StopwatchScreen() {
  const [mode, setMode] = useState<Mode>('stopwatch');
  const [running, setRunning] = useState(false);

  // stopwatch
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const swAnchor = useRef(0); // performance.now() - elapsed

  // timer
  const [duration, setDuration] = useState(60_000);
  const [remaining, setRemaining] = useState(60_000);
  const timerEnd = useRef(0); // absolute performance.now() target

  const rafRef = useRef<number | null>(null);

  // ---- animation loop ----
  const tick = useCallback(() => {
    const now = performance.now();
    if (mode === 'stopwatch') {
      setElapsed(now - swAnchor.current);
    } else {
      const rem = timerEnd.current - now;
      if (rem <= 0) {
        setRemaining(0);
        setRunning(false);
        finishFeedback();
        return;
      }
      setRemaining(rem);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [mode]);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  // Recompute immediately when returning to the app (rAF is paused while hidden)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !running) return;
      const now = performance.now();
      if (mode === 'stopwatch') setElapsed(now - swAnchor.current);
      else {
        const rem = timerEnd.current - now;
        if (rem <= 0) { setRemaining(0); setRunning(false); }
        else setRemaining(rem);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running, mode]);

  // ---- controls ----
  const start = () => {
    const now = performance.now();
    if (mode === 'stopwatch') {
      swAnchor.current = now - elapsed;
    } else {
      if (remaining <= 0) setRemaining(duration);
      timerEnd.current = now + (remaining > 0 ? remaining : duration);
    }
    setRunning(true);
  };
  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    if (mode === 'stopwatch') {
      setElapsed(0);
      setLaps([]);
    } else {
      setRemaining(duration);
    }
  };

  const addLap = () => setLaps(prev => [...prev, elapsed]);

  const adjustDuration = (deltaSec: number) => {
    if (running) return;
    const next = Math.max(5_000, Math.min(59 * 60_000, duration + deltaSec * 1000));
    setDuration(next);
    setRemaining(next);
  };

  const setPreset = (sec: number) => {
    if (running) return;
    setDuration(sec * 1000);
    setRemaining(sec * 1000);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMode(m);
  };

  // ---- derived display ----
  const progress = mode === 'stopwatch'
    ? (elapsed % 60_000) / 60_000
    : duration > 0 ? remaining / duration : 0;
  const dashOffset = CIRC * (1 - progress);

  const sw = fmtStopwatch(elapsed);
  const isTimerDone = mode === 'timer' && remaining <= 0;

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="screen-header" style={{ marginBottom: '18px' }}>
        <h1 className="screen-title">Timer</h1>
        <p className="screen-subtitle">{mode === 'stopwatch' ? 'Stopwatch & laps' : 'Rest between sets'}</p>
      </div>

      {/* Mode switch */}
      <div className="segmented" style={{ marginBottom: '8px' }}>
        <button className={mode === 'stopwatch' ? 'active' : ''} onClick={() => switchMode('stopwatch')}>
          <Watch size={15} /> Stopwatch
        </button>
        <button className={mode === 'timer' ? 'active' : ''} onClick={() => switchMode('timer')}>
          <TimerIcon size={15} /> Rest timer
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
          {mode === 'stopwatch' ? (
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
            {running ? 'Running' : mode === 'timer' && isTimerDone ? 'Time to lift' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Timer presets / adjust (timer mode, when not running) */}
      {mode === 'timer' && !running && (
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
        {mode === 'stopwatch' && (
          <button
            className="sw-fab sw-fab-secondary"
            onClick={running ? addLap : reset}
            aria-label={running ? 'Lap' : 'Reset'}
          >
            {running ? <Flag size={24} /> : <RotateCcw size={24} />}
          </button>
        )}

        <button
          className={`sw-fab ${running ? 'sw-fab-danger' : 'sw-fab-primary'}`}
          onClick={running ? pause : start}
          aria-label={running ? 'Pause' : 'Start'}
        >
          {running ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
        </button>

        {mode === 'timer' && (
          <button className="sw-fab sw-fab-secondary" onClick={reset} aria-label="Reset">
            <RotateCcw size={24} />
          </button>
        )}
      </div>

      {/* Laps (newest first) */}
      {mode === 'stopwatch' && laps.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          {laps.slice().reverse().map((lapTime, ri) => {
            const chronoIndex = laps.length - 1 - ri; // 0-based position in time order
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
