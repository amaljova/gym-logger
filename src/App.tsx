import { useState } from 'react';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Drawer from './components/Drawer';
import TodayScreen from './screens/TodayScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProgressScreen from './screens/ProgressScreen';
import StopwatchScreen from './screens/StopwatchScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useTheme } from './hooks/useTheme';

export type Tab =
  | 'today'
  | 'history'
  | 'progress'
  | 'stopwatch'
  | 'routines'
  | 'exercises'
  | 'settings';

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

      {renderScreen()}

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
