import React from 'react';
import { Home, Search } from 'lucide-react';
import { useTranslations } from '../../i18n';
import { AppScreenId } from '../../lib/commands';

interface TopbarProps {
  activeScreen: AppScreenId;
  onNavigateHome: () => void;
  onOpenPalette: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeScreen,
  onNavigateHome,
  onOpenPalette,
}) => {
  const t = useTranslations();

  const screenLabels: Record<AppScreenId, string> = {
    dashboard: t.nav.dashboard,
    tasks: t.nav.tasks,
    agenda: t.nav.agenda,
    settings: t.nav.settings,
    briefing: t.nav.briefing,
  };

  return (
    <header
      data-testid="app-topbar"
      className="flex items-center justify-between gap-4 px-8 pt-6 pb-2"
    >
      <nav
        aria-label={t.nav.sidebarLabel}
        className="flex items-center gap-2.5 text-sm"
      >
        <button
          type="button"
          onClick={onNavigateHome}
          aria-label={t.nav.dashboard}
          className="inline-flex items-center justify-center rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-muted select-none" aria-hidden="true">
          /
        </span>
        <span
          data-testid="topbar-breadcrumb-current"
          className="font-semibold text-primary"
        >
          {screenLabels[activeScreen]}
        </span>
      </nav>

      <button
        type="button"
        data-testid="topbar-search-trigger"
        onClick={onOpenPalette}
        className="focus-pill-control flex items-center justify-between gap-6 rounded-full px-4 py-2 text-sm text-secondary hover:border-accent-primary transition-colors min-w-[280px] lg:min-w-[320px]"
      >
        <span className="flex items-center gap-2.5">
          <Search className="h-4 w-4 text-secondary" aria-hidden="true" />
          <span>{t.app.searchPlaceholder}</span>
        </span>
        <kbd className="rounded-md border border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-primary">
          {t.app.searchShortcut}
        </kbd>
      </button>
    </header>
  );
};
