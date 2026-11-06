import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavPage, Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { CommandPalette } from './components/overlays/CommandPalette';
import { ShortcutsHelpModal } from './components/overlays/ShortcutsHelpModal';
import { ThemeProvider } from './context/ThemeContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTranslations } from './i18n';
import {
  CommandHistory,
  CommandHistorySnapshot,
  UndoCommandKind,
} from './lib/command-history';
import { AppScreenId, CommandId } from './lib/commands';
import { TaskRecord, listTasks } from './lib/db';
import { AgendaPage } from './pages/AgendaPage';
import { BriefingPage } from './pages/BriefingPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';

export interface UndoAction {
  kind?: UndoCommandKind;
  description: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
}

function getInitialScreenFromUrl(): AppScreenId {
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('page');
    if (
      p === 'dashboard' ||
      p === 'tasks' ||
      p === 'agenda' ||
      p === 'settings' ||
      p === 'briefing'
    ) {
      return p;
    }
  }
  return 'dashboard';
}

export const AppContent: React.FC = () => {
  const t = useTranslations();
  const [activeScreen, setActiveScreen] = useState<AppScreenId>(
    getInitialScreenFromUrl,
  );
  const [previousScreen, setPreviousScreen] = useState<NavPage>('dashboard');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [quickTaskTrigger, setQuickTaskTrigger] = useState(0);
  const [prefillQuickTask, setPrefillQuickTask] = useState<string | null>(null);
  const [selectedTaskIdFromPalette, setSelectedTaskIdFromPalette] = useState<
    string | null
  >(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      return new URLSearchParams(window.location.search).get('task');
    }
    return null;
  });
  const [paletteTasks, setPaletteTasks] = useState<TaskRecord[]>([]);
  const commandHistoryRef = useRef<CommandHistory>(new CommandHistory());
  const [historySnapshot, setHistorySnapshot] =
    useState<CommandHistorySnapshot>(() =>
      commandHistoryRef.current.getSnapshot(),
    );
  const [undoToastVisible, setUndoToastVisible] = useState(false);

  useEffect(() => {
    return commandHistoryRef.current.subscribe((snapshot) => {
      setHistorySnapshot(snapshot);
    });
  }, []);

  const pushUndoAction = useCallback((action: UndoAction) => {
    commandHistoryRef.current.push({
      kind: action.kind,
      description: action.description,
      undo: action.undo,
      redo: action.redo,
    });
    setUndoToastVisible(true);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!commandHistoryRef.current.canUndo()) {
      return;
    }
    await commandHistoryRef.current.undo();
    setUndoToastVisible(false);
  }, []);

  useEffect(() => {
    if (!undoToastVisible) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setUndoToastVisible(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [undoToastVisible]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }
    let mounted = true;
    listTasks()
      .then((items) => {
        if (mounted) {
          setPaletteTasks(items);
        }
      })
      .catch(() => {
        if (mounted) {
          setPaletteTasks([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isPaletteOpen]);

  const navigateToPage = useCallback((page: NavPage) => {
    setPreviousScreen(page);
    setActiveScreen(page);
  }, []);

  const executeCommand = useCallback(
    (commandId: CommandId) => {
      switch (commandId) {
        case 'nav.dashboard':
          navigateToPage('dashboard');
          break;
        case 'nav.tasks':
          navigateToPage('tasks');
          break;
        case 'nav.agenda':
          navigateToPage('agenda');
          break;
        case 'nav.settings':
          navigateToPage('settings');
          break;
        case 'nav.briefing':
          if (activeScreen !== 'briefing') {
            setPreviousScreen(activeScreen as NavPage);
          }
          setActiveScreen('briefing');
          break;
        case 'app.palette':
          setIsPaletteOpen((prev) => !prev);
          break;
        case 'tasks.new':
        case 'tasks.inline_add':
          navigateToPage('tasks');
          setQuickTaskTrigger((n) => n + 1);
          break;
        case 'app.undo':
          void handleUndo();
          break;
        case 'app.shortcuts_help':
          setIsShortcutsHelpOpen((prev) => !prev);
          break;
        case 'app.escape':
          if (isPaletteOpen) {
            setIsPaletteOpen(false);
          } else if (isShortcutsHelpOpen) {
            setIsShortcutsHelpOpen(false);
          } else if (activeScreen === 'briefing') {
            setActiveScreen(previousScreen);
          }
          break;
      }
    },
    [
      activeScreen,
      handleUndo,
      isPaletteOpen,
      isShortcutsHelpOpen,
      navigateToPage,
      previousScreen,
    ],
  );

  useKeyboardShortcuts({
    activeScreen,
    onExecuteCommand: executeCommand,
  });

  const activeSidebarPage: NavPage =
    activeScreen === 'briefing' ? previousScreen : activeScreen;

  return (
    <div className="flex min-h-screen bg-canvas text-primary font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-accent-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        {t.app.skipToContent}
      </a>

      <Sidebar
        activePage={activeSidebarPage}
        onNavigate={navigateToPage}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          activeScreen={activeScreen}
          onNavigateHome={() => navigateToPage('dashboard')}
          onOpenPalette={() => setIsPaletteOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-8 py-4 overflow-y-auto"
        >
          {activeScreen === 'dashboard' && (
            <DashboardPage
              onComposeFocus={() => navigateToPage('tasks')}
              onNavigateAgenda={() => navigateToPage('agenda')}
              onNavigateTasks={() => navigateToPage('tasks')}
              onNavigateSettings={() => navigateToPage('settings')}
              onOpenBriefing={() => executeCommand('nav.briefing')}
              onNewTask={() => executeCommand('tasks.new')}
              onPushUndo={pushUndoAction}
            />
          )}
          {activeScreen === 'tasks' && (
            <TasksPage
              quickAddFocusTrigger={quickTaskTrigger}
              prefillText={prefillQuickTask}
              onClearPrefill={() => setPrefillQuickTask(null)}
              initialSelectedTaskId={selectedTaskIdFromPalette}
              onNavigateSettings={() => navigateToPage('settings')}
              onPushUndo={pushUndoAction}
            />
          )}
          {activeScreen === 'agenda' && <AgendaPage />}
          {activeScreen === 'settings' && <SettingsPage />}
          {activeScreen === 'briefing' && (
            <BriefingPage onClose={() => setActiveScreen(previousScreen)} />
          )}
        </main>

        <footer
          data-testid="app-footer"
          className="flex flex-wrap items-center justify-between gap-4 px-8 py-4 text-xs text-secondary"
        >
          <span>{t.app.footerMotto}</span>
          <button
            type="button"
            data-testid="footer-shortcuts-btn"
            onClick={() => setIsShortcutsHelpOpen(true)}
            className="text-secondary hover:text-primary transition-colors font-medium"
          >
            {t.app.allShortcutsLink}
          </button>
        </footer>
      </div>

      {undoToastVisible && historySnapshot.canUndo && (
        <div
          data-testid="undo-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-8 z-40 flex items-center gap-3 rounded-full border border-subtle bg-accent-primary px-4 py-2.5 text-xs font-medium text-accent-foreground shadow-lg"
        >
          <span>
            {historySnapshot.lastCommand?.description
              ? `${historySnapshot.lastCommand.description} · ${t.app.undoToast}`
              : t.app.undoToast}
          </span>
          <button
            type="button"
            data-testid="undo-toast-btn"
            onClick={() => {
              void handleUndo();
            }}
            className="rounded-full border border-subtle bg-surface px-2.5 py-1 font-semibold text-primary hover:bg-surface-muted transition-colors"
          >
            {t.app.undo}
          </button>
        </div>
      )}

      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onExecuteCommand={executeCommand}
        tasks={paletteTasks}
        onSelectTask={(taskId) => {
          setSelectedTaskIdFromPalette(taskId);
          navigateToPage('tasks');
        }}
        onSelectTemplate={(templateText) => {
          setPrefillQuickTask(templateText);
          navigateToPage('tasks');
          setQuickTaskTrigger((n) => n + 1);
        }}
      />

      <ShortcutsHelpModal
        open={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
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
