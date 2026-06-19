import { useState, lazy, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import TodayScreen from './screens/TodayScreen';
import { useTheme } from './hooks/useTheme';

// Code-split the secondary screens so their JS is parsed only when first opened.
// This keeps initial load (and memory) small — Train is the landing screen and
// stays eager so there's no flash on startup.
const RoutinesScreen = lazy(() => import('./screens/RoutinesScreen'));
const ExercisesScreen = lazy(() => import('./screens/ExercisesScreen'));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen'));
const ProgressScreen = lazy(() => import('./screens/ProgressScreen'));
const StopwatchScreen = lazy(() => import('./screens/StopwatchScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));

export type Tab =
  | 'today'
  | 'history'
  | 'progress'
  | 'stopwatch'
  | 'routines'
  | 'exercises'
  | 'settings';

function ScreenFallback() {
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="screen-spinner" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  const [currentTab, setTab] = useState<Tab>('today');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pref, resolved, setTheme } = useTheme();

  // Navigate and always close the drawer.
  const go = (tab: Tab) => {
    setTab(tab);
    setDrawerOpen(false);
  };

  // Quick light/dark toggle from the app bar.
  const toggleTheme = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  const renderScreen = () => {
    switch (currentTab) {
      case 'today':
        return <TodayScreen onNavigateToRoutines={() => go('routines')} />;
      case 'routines':
        return <RoutinesScreen onManageExercises={() => go('exercises')} />;
      case 'exercises':
        return <ExercisesScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'progress':
        return <ProgressScreen />;
      case 'stopwatch':
        return <StopwatchScreen />;
      case 'settings':
        return <SettingsScreen pref={pref} setTheme={setTheme} />;
      default:
        return <TodayScreen onNavigateToRoutines={() => go('routines')} />;
    }
  };

  return (
    <div className="app-container">
      <TopBar
        resolved={resolved}
        pref={pref}
        onToggleTheme={toggleTheme}
        onOpenMenu={() => setDrawerOpen(true)}
      />

      <Suspense fallback={<ScreenFallback />}>
        {renderScreen()}
      </Suspense>

      <BottomNav currentTab={currentTab} setTab={go} />

      {drawerOpen && (
        <Drawer
          currentTab={currentTab}
          go={go}
          onClose={() => setDrawerOpen(false)}
          pref={pref}
          setTheme={setTheme}
        />
      )}
    </div>
  );
}
