import { Pause, Play, X, RotateCcw, Watch, Timer as TimerIcon } from 'lucide-react';
import { useTimer, fmtStopwatch, fmtTimer } from '../contexts/TimerContext';

interface TimerOverlayProps {
  onOpen: () => void;       // jump to the Timer tab
  onTimerTab: boolean;      // is the Timer screen currently shown?
}

/**
 * Floating control pill shown over every screen while a stopwatch or rest timer
 * is active. It persists through pause/finish and only disappears when the user
 * taps Close. While on the Timer tab, it shows the *other* timer (the one not
 * being viewed full-screen) so both are always reachable.
 */
export default function TimerOverlay({ onOpen, onTimerTab }: TimerOverlayProps) {
  const t = useTimer();

  // The timer shown full-screen on the Timer tab shouldn't also float.
  const hidden = onTimerTab ? (t.mode === 'stopwatch' ? 'stopwatch' : 'timer') : null;

  // Rest timer takes priority; otherwise show the stopwatch.
  let target: 'stopwatch' | 'timer' | null = null;
  if (t.restActive && hidden !== 'timer') target = 'timer';
  else if (t.swActive && hidden !== 'stopwatch') target = 'stopwatch';
  if (!target) return null;

  const isStopwatch = target === 'stopwatch';
  const running = isStopwatch ? t.swRunning : t.restRunning;
  const done = !isStopwatch && t.restFinished;

  const sw = fmtStopwatch(t.elapsed);
  const label = isStopwatch ? `${sw.main}.${sw.cs}` : done ? 'Done' : fmtTimer(t.remaining);
  const sub = isStopwatch ? 'Stopwatch' : done ? 'Rest over' : 'Rest';

  const togglePlay = () => {
    if (isStopwatch) running ? t.pauseSw() : t.startSw();
    else running ? t.pauseRest() : t.startRest();
  };
  const reset = () => (isStopwatch ? t.resetSw() : t.resetRest());
  const close = () => (isStopwatch ? t.closeSw() : t.closeRest());

  return (
    <div className={`timer-overlay${done ? ' timer-overlay-done' : ''}`} role="status">
      <button className="timer-overlay-main" onClick={onOpen} aria-label="Open timer">
        <span className="timer-overlay-icon">
          {isStopwatch ? <Watch size={16} /> : <TimerIcon size={16} />}
        </span>
        <span className="timer-overlay-time">{label}</span>
        <span className="timer-overlay-sub">{sub}</span>
      </button>

      <div className="timer-overlay-actions">
        <button className="timer-overlay-btn ghost" onClick={reset} aria-label="Reset">
          <RotateCcw size={17} />
        </button>
        {!done && (
          <button className="timer-overlay-btn" onClick={togglePlay} aria-label={running ? 'Pause' : 'Resume'}>
            {running ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
        <button className="timer-overlay-btn ghost" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
