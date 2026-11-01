import React, { useRef } from 'react';
import { Calendar, CheckSquare, LayoutDashboard, Mail, Settings } from 'lucide-react';
import { useTranslations } from '../../i18n';

export type NavPage = 'dashboard' | 'tasks' | 'agenda' | 'settings';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const t = useTranslations();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const navItems: Array<{
    id: NavPage;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      shortcut: t.nav.shortcuts.dashboard,
      icon: <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'tasks',
      label: t.nav.tasks,
      shortcut: t.nav.shortcuts.tasks,
      icon: <CheckSquare className="h-5 w-5 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'agenda',
      label: t.nav.agenda,
      shortcut: t.nav.shortcuts.agenda,
      icon: <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      shortcut: t.nav.shortcuts.settings,
      icon: <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % navItems.length;
      buttonRefs.current[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (index - 1 + navItems.length) % navItems.length;
      buttonRefs.current[prevIndex]?.focus();
    }
  };

  return (
    <aside
      aria-label={t.nav.sidebarLabel}
      data-testid="app-sidebar"
      className="w-56 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between select-none"
    >
      <div className="p-3">
        <div className="px-3 py-2 mb-4">
          <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.app.title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.app.subtitle}</p>
        </div>

        <nav aria-label={t.nav.sidebarLabel}>
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    ref={(el) => {
                      buttonRefs.current[index] = el;
                    }}
                    type="button"
                    data-testid={`nav-${item.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onNavigate(item.id)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <kbd
                      className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                        isActive
                          ? 'bg-blue-700 text-blue-100 dark:bg-blue-600 dark:text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {item.shortcut}
                    </kbd>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        {/* DSH-2 : Emplacement réservé au module Mail dans la barre latérale, masqué par défaut */}
        <div
          data-testid="sidebar-mail-reserved"
          hidden
          aria-hidden="true"
          className="hidden items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          <span>{t.nav.mailReserved}</span>
        </div>
        <p className="px-2 text-xs text-slate-600 dark:text-slate-400">{t.app.keyboardHint}</p>
      </div>
    </aside>
  );
};
