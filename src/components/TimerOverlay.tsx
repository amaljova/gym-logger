import { Pause, Play, X, Watch, Timer as TimerIcon } from 'lucide-react';
import { useTimer, fmtStopwatch, fmtTimer } from '../contexts/TimerContext';

interface TimerOverlayProps {
  onOpen: () => void; // jump to the Timer tab
}

/**
 * Floating pill shown over every screen while the stopwatch / rest timer is
 * active (running, or a rest timer that just finished). Tapping the body opens
 * the Timer tab; the controls let you pause/resume or dismiss without leaving
 * the current screen.
 */
export default function TimerOverlay({ onOpen }: TimerOverlayProps) {
  const { mode, running, elapsed, remaining, isActive, isTimerDone, start, pause, acknowledge } = useTimer();

  if (!isActive) return null;

  const sw = fmtStopwatch(elapsed);
  const label = mode === 'stopwatch' ? `${sw.main}.${sw.cs}` : isTimerDone ? 'Done' : fmtTimer(remaining);

  return (
    <div className={`timer-overlay${isTimerDone ? ' timer-overlay-done' : ''}`} role="status">
      <button className="timer-overlay-main" onClick={onOpen} aria-label="Open timer">
        <span className="timer-overlay-icon">
          {mode === 'stopwatch' ? <Watch size={16} /> : <TimerIcon size={16} />}
        </span>
        <span className="timer-overlay-time">{label}</span>
        <span className="timer-overlay-sub">{mode === 'stopwatch' ? 'Stopwatch' : isTimerDone ? 'Rest over' : 'Rest'}</span>
      </button>

      {isTimerDone ? (
        <button className="timer-overlay-btn" onClick={acknowledge} aria-label="Dismiss">
          <X size={18} />
        </button>
      ) : (
        <button className="timer-overlay-btn" onClick={running ? pause : start} aria-label={running ? 'Pause' : 'Resume'}>
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
      )}
    </div>
  );
}
