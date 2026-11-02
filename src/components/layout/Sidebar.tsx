import React, { useRef } from 'react';
import {
  Aperture,
  Calendar,
  CheckCircle2,
  ChevronsUpDown,
  HelpCircle,
  LayoutGrid,
  Mail,
  SlidersHorizontal,
  Sprout,
  User,
} from 'lucide-react';
import { useTranslations } from '../../i18n';
import { getSidebarCommands } from '../../lib/commands';

export type NavPage = 'dashboard' | 'tasks' | 'agenda' | 'settings';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onOpenShortcutsHelp?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  onOpenShortcutsHelp,
}) => {
  const t = useTranslations();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sidebarCommands = getSidebarCommands();

  const iconByScreen: Record<NavPage, React.ReactNode> = {
    dashboard: <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />,
    tasks: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    agenda: <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />,
    settings: <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />,
  };

  const navItems = sidebarCommands.map((cmd) => {
    const pageId = (cmd.targetScreen ?? 'dashboard') as NavPage;
    const labelKey = cmd.sidebarLabelKey ?? 'dashboard';
    return {
      id: pageId,
      label: t.nav[labelKey],
      shortcut: cmd.shortcutBadge,
      icon: iconByScreen[pageId],
    };
  });

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
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
        {/* Logo focus */}
        <div className="flex items-center gap-3 px-2 py-2 mb-6">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary text-accent-foreground">
            <Aperture className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-xl font-display font-bold tracking-tight text-primary">
            {t.app.brand}
          </span>
        </div>

        <p className="px-3 mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
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
                      style={
                        isActive
                          ? {
                              backgroundColor:
                                'color-mix(in srgb, var(--bg-surface) 18%, var(--accent-primary))',
                            }
                          : undefined
                      }
                      className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold ${
                        isActive
                          ? 'text-accent-foreground'
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

      {/* Bas de barre latérale : encart "Un pas à la fois.", aide et espace */}
      <div className="p-4 flex flex-col gap-3">
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

        <div className="rounded-2xl border border-subtle bg-surface-muted p-4">
          <div className="mb-2 inline-flex items-center justify-center text-primary">
            <Sprout className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs font-display font-bold text-primary mb-1">
            {t.nav.stepByStepTitle}
          </p>
          <p className="text-[11px] leading-relaxed text-secondary">
            {t.nav.stepByStepDescription}
          </p>
        </div>

        <button
          type="button"
          data-testid="sidebar-help-btn"
          onClick={onOpenShortcutsHelp}
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
        >
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t.nav.needHelp}</span>
        </button>

        <div className="pt-2 border-t border-subtle">
          <button
            type="button"
            data-testid="sidebar-workspace-btn"
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center justify-between gap-2 rounded-2xl px-2 py-1.5 text-left hover:bg-surface-muted transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-primary">
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-primary">
                  {t.nav.workspaceTitle}
                </span>
                <span className="text-[11px] text-secondary">
                  {t.nav.workspaceSubtitle}
                </span>
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};
