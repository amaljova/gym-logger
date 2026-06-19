import { ClipboardList, Dumbbell, Settings, X, Sun, Moon, Monitor, History, TrendingUp, Timer } from 'lucide-react';
import type { Tab } from '../App';
import type { ThemePref } from '../hooks/useTheme';

interface DrawerProps {
  currentTab: Tab;
  go: (tab: Tab) => void;
  onClose: () => void;
  pref: ThemePref;
  setTheme: (p: ThemePref) => void;
}

// Primary destinations (also in the bottom bar) — listed here too for discoverability.
const NAV_ITEMS: { id: Tab; label: string; icon: typeof ClipboardList; desc: string }[] = [
  { id: 'today', label: 'Train', icon: Dumbbell, desc: "Today's workout" },
  { id: 'history', label: 'History', icon: History, desc: 'Past sessions & calendar' },
  { id: 'progress', label: 'Progress', icon: TrendingUp, desc: 'Strength over time' },
  { id: 'stopwatch', label: 'Timer', icon: Timer, desc: 'Stopwatch & rest timer' },
];

const MENU_ITEMS: { id: Tab; label: string; icon: typeof ClipboardList; desc: string }[] = [
  { id: 'routines', label: 'Routines', icon: ClipboardList, desc: 'Build workout templates' },
  { id: 'exercises', label: 'Exercises', icon: Dumbbell, desc: 'Manage your exercise library' },
  { id: 'settings', label: 'Settings', icon: Settings, desc: 'Backup, sync & preferences' },
];

const THEME_OPTIONS: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function Drawer({ currentTab, go, onClose, pref, setTheme }: DrawerProps) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Menu">
        <div className="drawer-header">
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Menu</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu" style={{ width: 40, height: 40 }}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-section-label">Navigate</div>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`drawer-item${active ? ' active' : ''}`}
              onClick={() => go(item.id)}
            >
              <span className="drawer-item-icon"><Icon size={20} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{item.desc}</span>
              </span>
            </button>
          );
        })}

        <div className="drawer-section-label">Manage</div>
        {MENU_ITEMS.map(item => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`drawer-item${active ? ' active' : ''}`}
              onClick={() => go(item.id)}
            >
              <span className="drawer-item-icon"><Icon size={20} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{item.desc}</span>
              </span>
            </button>
          );
        })}

        <div className="drawer-section-label">Appearance</div>
        <div className="segmented" style={{ margin: '0 8px' }}>
          {THEME_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                className={pref === opt.id ? 'active' : ''}
                onClick={() => setTheme(opt.id)}
              >
                <Icon size={15} /> {opt.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', padding: '12px' }}>
          Gym Logger · offline-first
        </p>
      </aside>
    </>
  );
}
