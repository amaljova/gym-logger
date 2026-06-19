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

export type OverlayTarget = 'stopwatch' | 'timer' | null;

interface TimerContextValue {
  mode: TimerMode;            // which view is selected on the Timer screen
  switchMode: (m: TimerMode) => void;

  // Stopwatch (independent)
  swRunning: boolean;
  swActive: boolean;          // started & not closed (survives pause)
  elapsed: number;
  laps: number[];
  swProgress: number;
  startSw: () => void;
  pauseSw: () => void;
  resetSw: () => void;
  closeSw: () => void;
  addLap: () => void;
  restartStopwatch: () => void;

  // Rest timer (independent)
  restRunning: boolean;
  restActive: boolean;        // started & not closed (survives pause/finish)
  remaining: number;
  duration: number;
  restFinished: boolean;
  restProgress: number;
  startRest: () => void;
  pauseRest: () => void;
  resetRest: () => void;
  closeRest: () => void;
  adjustDuration: (deltaSec: number) => void;
  setPreset: (sec: number) => void;

  // Auto-start the stopwatch when a set is completed (opt-in, off by default).
  autoStartOnSet: boolean;
  setAutoStartOnSet: (v: boolean) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TimerMode>('stopwatch');

  // ---- Stopwatch state ----
  const [swRunning, setSwRunning] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const swAnchor = useRef(0);          // performance.now() - elapsed
  const elapsedRef = useRef(0);
  const swRaf = useRef<number | null>(null);

  // ---- Rest timer state ----
  const [restRunning, setRestRunning] = useState(false);
  const [restActive, setRestActive] = useState(false);
  const [duration, setDuration] = useState(60_000);
  const [remaining, setRemaining] = useState(60_000);
  const [restFinished, setRestFinished] = useState(false);

  // ---- Settings ----
  const [autoStartOnSet, setAutoStartOnSetState] = useState<boolean>(
    () => localStorage.getItem('gym_auto_sw') === '1'
  );
  const setAutoStartOnSet = useCallback((v: boolean) => {
    setAutoStartOnSetState(v);
    localStorage.setItem('gym_auto_sw', v ? '1' : '0');
  }, []);
  const durationRef = useRef(60_000);
  const remainingRef = useRef(60_000);
  const restEnd = useRef(0);           // absolute performance.now() target
  const restRaf = useRef<number | null>(null);

  // ---- Stopwatch loop (runs only while the stopwatch is running) ----
  const swTick = useCallback(() => {
    const v = performance.now() - swAnchor.current;
    elapsedRef.current = v;
    setElapsed(v);
    swRaf.current = requestAnimationFrame(swTick);
  }, []);
  useEffect(() => {
    if (swRunning) swRaf.current = requestAnimationFrame(swTick);
    return () => { if (swRaf.current) cancelAnimationFrame(swRaf.current); };
  }, [swRunning, swTick]);

  // ---- Rest loop (independent of the stopwatch) ----
  const restTick = useCallback(() => {
    const rem = restEnd.current - performance.now();
    if (rem <= 0) {
      remainingRef.current = 0;
      setRemaining(0);
      setRestRunning(false);
      setRestFinished(true);
      finishFeedback();
      return;
    }
    remainingRef.current = rem;
    setRemaining(rem);
    restRaf.current = requestAnimationFrame(restTick);
  }, []);
  useEffect(() => {
    if (restRunning) restRaf.current = requestAnimationFrame(restTick);
    return () => { if (restRaf.current) cancelAnimationFrame(restRaf.current); };
  }, [restRunning, restTick]);

  // rAF is paused while the tab is hidden — recompute both on return.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = performance.now();
      if (swRunning) { const v = now - swAnchor.current; elapsedRef.current = v; setElapsed(v); }
      if (restRunning) {
        const rem = restEnd.current - now;
        if (rem <= 0) { remainingRef.current = 0; setRemaining(0); setRestRunning(false); setRestFinished(true); }
        else { remainingRef.current = rem; setRemaining(rem); }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [swRunning, restRunning]);

  // ---- Stopwatch controls ----
  const startSw = useCallback(() => {
    swAnchor.current = performance.now() - elapsedRef.current;
    setSwActive(true);
    setSwRunning(true);
  }, []);
  const pauseSw = useCallback(() => setSwRunning(false), []);
  // Reset keeps the session active (restarts from zero).
  const resetSw = useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    setLaps([]);
    swAnchor.current = performance.now();
  }, []);
  // Close fully stops, clears, and ends the session (float disappears).
  const closeSw = useCallback(() => {
    setSwRunning(false);
    setSwActive(false);
    elapsedRef.current = 0;
    setElapsed(0);
    setLaps([]);
  }, []);
  const addLap = useCallback(() => setLaps(p => [...p, elapsedRef.current]), []);
  // Used by "auto-start on set complete": fresh count from zero, running.
  const restartStopwatch = useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    setLaps([]);
    swAnchor.current = performance.now();
    setSwActive(true);
    setSwRunning(true);
  }, []);

  // ---- Rest controls ----
  const startRest = useCallback(() => {
    const base = remainingRef.current > 0 ? remainingRef.current : durationRef.current;
    remainingRef.current = base;
    setRemaining(base);
    restEnd.current = performance.now() + base;
    setRestFinished(false);
    setRestActive(true);
    setRestRunning(true);
  }, []);
  const pauseRest = useCallback(() => setRestRunning(false), []);
  // Reset restarts from the full duration (keeps running if it was running).
  const resetRest = useCallback(() => {
    remainingRef.current = durationRef.current;
    setRemaining(durationRef.current);
    setRestFinished(false);
    setRestRunning(prev => {
      if (prev) restEnd.current = performance.now() + durationRef.current;
      return prev;
    });
  }, []);
  const closeRest = useCallback(() => {
    setRestRunning(false);
    setRestActive(false);
    setRestFinished(false);
    remainingRef.current = durationRef.current;
    setRemaining(durationRef.current);
  }, []);
  const adjustDuration = useCallback((deltaSec: number) => {
    if (restRunning) return;
    const next = Math.max(5_000, Math.min(59 * 60_000, durationRef.current + deltaSec * 1000));
    durationRef.current = next;
    remainingRef.current = next;
    setDuration(next);
    setRemaining(next);
    setRestFinished(false);
  }, [restRunning]);
  const setPreset = useCallback((sec: number) => {
    if (restRunning) return;
    const ms = sec * 1000;
    durationRef.current = ms;
    remainingRef.current = ms;
    setDuration(ms);
    setRemaining(ms);
    setRestFinished(false);
  }, [restRunning]);

  // Switching the view never stops either timer.
  const switchMode = useCallback((m: TimerMode) => setMode(m), []);

  const swProgress = (elapsed % 60_000) / 60_000;
  const restProgress = duration > 0 ? remaining / duration : 0;

  const value: TimerContextValue = {
    mode, switchMode,
    swRunning, swActive, elapsed, laps, swProgress, startSw, pauseSw, resetSw, closeSw, addLap, restartStopwatch,
    restRunning, restActive, remaining, duration, restFinished, restProgress,
    startRest, pauseRest, resetRest, closeRest, adjustDuration, setPreset,
    autoStartOnSet, setAutoStartOnSet,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within a TimerProvider');
  return ctx;
}
