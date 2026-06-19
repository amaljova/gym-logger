import { useEffect, useState, useCallback } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'gym_theme_pref';

function getStoredPref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePref): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** Applies the resolved theme to <html> and syncs the browser theme-color. */
function apply(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0c' : '#f4f5f7');
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(getStoredPref);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(getStoredPref()));

  // Apply on mount and whenever the preference changes.
  useEffect(() => {
    const r = resolve(pref);
    setResolved(r);
    apply(r);
    localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  // When following the system, react to OS-level theme changes live.
  useEffect(() => {
    if (pref !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const r = systemPrefersDark() ? 'dark' : 'light';
      setResolved(r);
      apply(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const setTheme = useCallback((p: ThemePref) => setPref(p), []);

  return { pref, resolved, setTheme };
}
