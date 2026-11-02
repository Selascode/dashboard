import React, { useEffect, useState } from 'react';
import { NavPage, Sidebar } from './components/layout/Sidebar';
import { ThemeProvider } from './context/ThemeContext';
import { useTranslations } from './i18n';
import { AgendaPage } from './pages/AgendaPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';

export const AppContent: React.FC = () => {
  const t = useTranslations();
  const [activePage, setActivePage] = useState<NavPage>('dashboard');

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key === '1') {
        event.preventDefault();
        setActivePage('dashboard');
      } else if (event.key === '2') {
        event.preventDefault();
        setActivePage('tasks');
      } else if (event.key === '3') {
        event.preventDefault();
        setActivePage('agenda');
      } else if (event.key === '4') {
        event.preventDefault();
        setActivePage('settings');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-canvas text-primary font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-accent-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        {t.app.skipToContent}
      </a>

      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 p-6 overflow-y-auto"
      >
        {activePage === 'dashboard' && (
          <DashboardPage onComposeFocus={() => setActivePage('tasks')} />
        )}
        {activePage === 'tasks' && <TasksPage />}
        {activePage === 'agenda' && <AgendaPage />}
        {activePage === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
