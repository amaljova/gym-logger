import { Dumbbell, History, TrendingUp, Settings, ClipboardList } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'today' | 'routines' | 'history' | 'progress' | 'settings';
  setTab: (tab: 'today' | 'routines' | 'history' | 'progress' | 'settings') => void;
}

export default function BottomNav({ currentTab, setTab }: BottomNavProps) {
  const tabs = [
    { id: 'today', label: 'Train', icon: Dumbbell },
    { id: 'routines', label: 'Routines', icon: ClipboardList },
    { id: 'history', label: 'History', icon: History },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        {tabs.map((tab) => {
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
            >
              <div style={styles.iconWrap}>
                <Icon size={20} style={isActive ? styles.activeIcon : {}} />
                {isActive && <div style={styles.activeGlow} />}
              </div>
              <span style={{
                ...styles.tabLabel,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? '600' : '400',
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
    padding: '0 8px 0',
  },
  navInner: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '68px',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '0',
    // Extend background into the iOS home-indicator area
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
    gap: '2px',
    cursor: 'pointer',
    width: '20%',
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
    filter: 'drop-shadow(0 0 6px rgba(93, 202, 165, 0.5))',
  },
  activeGlow: {
    position: 'absolute' as const,
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(93, 202, 165, 0.15) 0%, transparent 70%)',
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
