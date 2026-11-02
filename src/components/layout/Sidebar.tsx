import React, { useRef } from 'react';
import { Calendar, CheckCircle2, LayoutGrid, Mail, SlidersHorizontal } from 'lucide-react';
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
      icon: <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'tasks',
      label: t.nav.tasks,
      shortcut: t.nav.shortcuts.tasks,
      icon: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'agenda',
      label: t.nav.agenda,
      shortcut: t.nav.shortcuts.agenda,
      icon: <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      shortcut: t.nav.shortcuts.settings,
      icon: <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />,
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
      className="w-60 shrink-0 border-r border-subtle bg-surface flex flex-col justify-between select-none"
    >
      <div className="p-4">
        <div className="px-2 py-2 mb-6">
          <p className="text-lg font-display font-bold tracking-tight text-primary">
            {t.app.brand}
          </p>
        </div>

        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {t.nav.sectionTitle}
        </p>

        <nav aria-label={t.nav.sidebarLabel}>
          <ul className="space-y-1.5">
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
                    className={`w-full flex items-center justify-between gap-2 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-primary text-accent-foreground'
                        : 'text-secondary hover:bg-surface-muted hover:text-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <kbd
                      className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold ${
                        isActive
                          ? 'bg-surface/15 text-accent-foreground'
                          : 'bg-surface-muted text-secondary'
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

      <div className="p-4 border-t border-subtle">
        {/* DSH-2 : Emplacement réservé au module Mail dans la barre latérale, masqué par défaut */}
        <div
          data-testid="sidebar-mail-reserved"
          hidden
          aria-hidden="true"
          className="hidden items-center gap-2 px-3 py-2 text-xs text-muted"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          <span>{t.nav.mailReserved}</span>
        </div>
        <p className="px-2 text-xs text-secondary">{t.app.keyboardHint}</p>
      </div>
    </aside>
  );
};
