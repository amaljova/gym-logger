import { Pause, Play, X, RotateCcw, Watch, Timer as TimerIcon } from 'lucide-react';
import { useTimer, fmtStopwatch, fmtTimer } from '../contexts/TimerContext';

interface TimerOverlayProps {
  onOpen: () => void; // jump to the Timer tab
}

/**
 * Floating control pill shown over every screen while a stopwatch or rest timer
 * is active. Shows the rest timer when it's running/finished (time-critical),
 * otherwise the stopwatch. Provides reset / pause-resume / close inline so the
 * user never has to leave their current screen.
 */
export default function TimerOverlay({ onOpen }: TimerOverlayProps) {
  const t = useTimer();
  const target = t.overlayTarget;
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
