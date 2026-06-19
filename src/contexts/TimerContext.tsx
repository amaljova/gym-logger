import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

export type TimerMode = 'stopwatch' | 'timer';

// ---- time formatting helpers (exported for screens/overlay) ----
export function fmtStopwatch(ms: number) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return { main: `${pad(min)}:${pad(sec)}`, cs: pad(cs) };
}

export function fmtTimer(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(min)}:${pad(sec)}`;
}

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

export const PRESETS = [30, 60, 90, 120, 180]; // seconds

interface TimerContextValue {
  mode: TimerMode;
  running: boolean;
  elapsed: number;
  laps: number[];
  duration: number;
  remaining: number;
  isTimerDone: boolean;
  /** running, or a finished rest-timer awaiting acknowledgement */
  isActive: boolean;
  progress: number; // 0..1 for the ring
  start: () => void;
  pause: () => void;
  reset: () => void;
  addLap: () => void;
  adjustDuration: (deltaSec: number) => void;
  setPreset: (sec: number) => void;
  switchMode: (m: TimerMode) => void;
  acknowledge: () => void; // dismiss the "done" state
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [running, setRunning] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const swAnchor = useRef(0);

  const [duration, setDuration] = useState(60_000);
  const [remaining, setRemaining] = useState(60_000);
  const timerEnd = useRef(0);

  const [finished, setFinished] = useState(false);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const now = performance.now();
    if (mode === 'stopwatch') {
      setElapsed(now - swAnchor.current);
    } else {
      const rem = timerEnd.current - now;
      if (rem <= 0) {
        setRemaining(0);
        setRunning(false);
        setFinished(true);
        finishFeedback();
        return;
      }
      setRemaining(rem);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [mode]);

  useEffect(() => {
    if (running) rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, tick]);

  // rAF is throttled/paused while the tab is hidden — recompute on return.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !running) return;
      const now = performance.now();
      if (mode === 'stopwatch') setElapsed(now - swAnchor.current);
      else {
        const rem = timerEnd.current - now;
        if (rem <= 0) { setRemaining(0); setRunning(false); setFinished(true); }
        else setRemaining(rem);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running, mode]);

  const start = useCallback(() => {
    const now = performance.now();
    setFinished(false);
    if (mode === 'stopwatch') {
      swAnchor.current = now - elapsed;
    } else {
      const base = remaining > 0 ? remaining : duration;
      if (remaining <= 0) setRemaining(duration);
      timerEnd.current = now + base;
    }
    setRunning(true);
  }, [mode, elapsed, remaining, duration]);

  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    setRunning(false);
    setFinished(false);
    if (mode === 'stopwatch') { setElapsed(0); setLaps([]); }
    else setRemaining(duration);
  }, [mode, duration]);

  const addLap = useCallback(() => setLaps(prev => [...prev, elapsed]), [elapsed]);

  const adjustDuration = useCallback((deltaSec: number) => {
    if (running) return;
    setDuration(d => {
      const next = Math.max(5_000, Math.min(59 * 60_000, d + deltaSec * 1000));
      setRemaining(next);
      return next;
    });
  }, [running]);

  const setPreset = useCallback((sec: number) => {
    if (running) return;
    setDuration(sec * 1000);
    setRemaining(sec * 1000);
    setFinished(false);
  }, [running]);

  const switchMode = useCallback((m: TimerMode) => {
    setMode(prev => {
      if (prev === m) return prev;
      setRunning(false);
      setFinished(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return m;
    });
  }, []);

  const acknowledge = useCallback(() => setFinished(false), []);

  const isTimerDone = mode === 'timer' && remaining <= 0;
  const isActive = running || finished;
  const progress = mode === 'stopwatch'
    ? (elapsed % 60_000) / 60_000
    : duration > 0 ? remaining / duration : 0;

  const value: TimerContextValue = {
    mode, running, elapsed, laps, duration, remaining, isTimerDone, isActive, progress,
    start, pause, reset, addLap, adjustDuration, setPreset, switchMode, acknowledge,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within a TimerProvider');
  return ctx;
}
