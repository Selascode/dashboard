import React from 'react';
import { Calendar, Clock, Focus, Pin } from 'lucide-react';
import { useTranslations } from '../i18n';

interface DashboardPageProps {
  onComposeFocus?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onComposeFocus }) => {
  const t = useTranslations();

  return (
    <div data-testid="page-dashboard" className="flex flex-col h-full gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
          {t.dashboard.heading}
        </h1>
        <p className="text-sm text-secondary">{t.dashboard.description}</p>
      </header>

      {/* DSH-1 & DSH-3 : Mise en page fixe à 4 zones principales */}
      <div
        data-testid="dashboard-layout"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1"
      >
        {/* Zone 1 : Focus 5 */}
        <section
          aria-labelledby="focus5-heading"
          data-testid="zone-focus5"
          className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-subtle bg-surface p-6"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center rounded-2xl bg-surface-muted p-2.5 text-primary">
                  <Focus className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="focus5-heading"
                    className="text-lg font-display font-bold text-primary"
                  >
                    {t.dashboard.focusZone.title}
                  </h2>
                  <span className="text-xs text-secondary">
                    {t.dashboard.focusZone.subtitle}
                  </span>
                </div>
              </div>

              <span
                data-testid="focus5-progress"
                className="rounded-full border border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-primary"
              >
                0/5 {t.dashboard.focusZone.prioritiesSuffix}
              </span>
            </div>

            <div className="my-8 flex flex-col items-center justify-center rounded-2xl p-8 text-center">
              <p className="text-lg font-display font-bold text-primary mb-2">
                {t.dashboard.focusZone.emptyTitle}
              </p>
              <p className="text-sm text-secondary max-w-md mb-1">
                {t.dashboard.focusZone.emptyDescription}
              </p>
              <p className="text-sm text-secondary max-w-md mb-5">
                {t.dashboard.focusZone.emptySubDescription}
              </p>
              <button
                type="button"
                data-testid="compose-focus-btn"
                onClick={onComposeFocus}
                className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                + {t.dashboard.focusZone.composeButton}
              </button>
            </div>
          </div>
        </section>

        {/* Colonne de droite : Agenda du jour + Prochaines échéances */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section
            aria-labelledby="agenda-today-heading"
            data-testid="zone-today-agenda"
            className="flex-1 rounded-3xl border border-subtle bg-surface p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2
                  id="agenda-today-heading"
                  className="text-base font-display font-bold text-primary"
                >
                  {t.dashboard.agendaZone.title}
                </h2>
              </div>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">
                {t.dashboard.agendaZone.subtitle}
              </span>
            </div>
            <p className="text-sm font-semibold text-primary">
              {t.dashboard.agendaZone.emptyTitle}
            </p>
            <p className="text-xs text-secondary mt-1">
              {t.dashboard.agendaZone.empty}
            </p>
          </section>

          <section
            aria-labelledby="upcoming-deadlines-heading"
            data-testid="zone-upcoming-deadlines"
            className="flex-1 rounded-3xl border border-subtle bg-surface p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2
                  id="upcoming-deadlines-heading"
                  className="text-base font-display font-bold text-primary"
                >
                  {t.dashboard.deadlinesZone.title}
                </h2>
              </div>
            </div>
            <p className="text-sm font-semibold text-primary">
              {t.dashboard.deadlinesZone.emptyTitle}
            </p>
            <p className="text-xs text-secondary mt-1">
              {t.dashboard.deadlinesZone.empty}
            </p>
          </section>
        </div>
      </div>

      {/* Zone 4 : Raccourcis épinglés */}
      <section
        aria-labelledby="pinned-shortcuts-heading"
        data-testid="zone-pinned-shortcuts"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2
              id="pinned-shortcuts-heading"
              className="text-base font-display font-bold text-primary"
            >
              {t.dashboard.ShortcutsZone.title}
            </h2>
          </div>
          <p className="text-xs text-secondary">
            {t.dashboard.ShortcutsZone.empty}
          </p>
        </div>
      </section>

      {/* DSH-2 : Zone réservée au mail sur le Dashboard, masquée tant que le module mail n'existe pas */}
      <section
        data-testid="dashboard-mail-reserved"
        hidden
        aria-hidden="true"
        className="hidden"
      >
        <h2>{t.dashboard.mailZone.title}</h2>
        <p>{t.dashboard.mailZone.description}</p>
      </section>
    </div>
  );
};
