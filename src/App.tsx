import { useState } from 'react';
import BottomNav from './components/BottomNav';
import TodayScreen from './screens/TodayScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'today' | 'routines' | 'history' | 'progress' | 'settings';

export default function App() {
  const [currentTab, setTab] = useState<Tab>('today');

  const renderScreen = () => {
    switch (currentTab) {
      case 'today':
        return <TodayScreen onNavigateToRoutines={() => setTab('routines')} />;
      case 'routines':
        return <RoutinesScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'progress':
        return <ProgressScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <TodayScreen onNavigateToRoutines={() => setTab('routines')} />;
    }
  };

  return (
    <div className="app-container">
      {renderScreen()}
      <BottomNav currentTab={currentTab} setTab={setTab} />
    </div>
  );
}
