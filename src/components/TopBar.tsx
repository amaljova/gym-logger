import { Menu, Sun, Moon, Dumbbell } from 'lucide-react';
import type { ResolvedTheme, ThemePref } from '../hooks/useTheme';

interface TopBarProps {
  resolved: ResolvedTheme;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
  pref: ThemePref;
}

export default function TopBar({ resolved, onToggleTheme, onOpenMenu, pref }: TopBarProps) {
  return (
    <header className="app-bar">
      <div className="app-bar-title">
        <Dumbbell size={20} style={{ color: 'var(--accent)' }} />
        <span>Gym Logger</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={pref === 'system' ? 'Theme: system' : `Theme: ${pref}`}
        >
          {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="icon-btn" onClick={onOpenMenu} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}
