import { Dumbbell, History, TrendingUp, Timer } from 'lucide-react';
import type { Tab } from '../App';

interface BottomNavProps {
  currentTab: Tab;
  setTab: (tab: Tab) => void;
}

// Only the primary destinations live in the bottom bar. Routines, Exercises
// and Settings are reachable from the hamburger menu (Drawer).
const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: 'today', label: 'Train', icon: Dumbbell },
  { id: 'history', label: 'History', icon: History },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'stopwatch', label: 'Timer', icon: Timer },
];

export default function BottomNav({ currentTab, setTab }: BottomNavProps) {
  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                ...styles.tabButton,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div style={styles.iconWrap}>
                <Icon size={22} style={isActive ? styles.activeIcon : undefined} />
                {isActive && <div style={styles.activeGlow} />}
              </div>
              <span style={{
                ...styles.tabLabel,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
              }}>
                {tab.label}
              </span>
              {isActive && <div style={styles.activeDot} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed' as const,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '480px',
    zIndex: 90,
  },
  navInner: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '64px',
    backgroundColor: 'var(--bg-nav)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--hairline)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxSizing: 'content-box' as const,
  },
  tabButton: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    cursor: 'pointer',
    width: '25%',
    height: '100%',
    padding: '6px 0 8px',
    position: 'relative' as const,
    transition: 'color 0.2s ease',
  },
  iconWrap: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: '10px',
    letterSpacing: '0.3px',
    transition: 'color 0.2s ease',
  },
  activeIcon: {
    filter: 'drop-shadow(0 0 6px var(--accent-glow))',
  },
  activeGlow: {
    position: 'absolute' as const,
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
    opacity: 0.5,
    pointerEvents: 'none' as const,
  },
  activeDot: {
    position: 'absolute' as const,
    top: '2px',
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 6px var(--accent-glow)',
  },
};
