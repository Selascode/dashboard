import React from 'react';
import { Calendar, Clock, Compass, Link2, Sparkles } from 'lucide-react';
import { useTranslations } from '../i18n';

interface DashboardPageProps {
  onComposeFocus?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onComposeFocus }) => {
  const t = useTranslations();

  return (
    <div data-testid="page-dashboard" className="flex flex-col h-full gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.dashboard.heading}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.dashboard.description}</p>
      </header>

      {/* DSH-1 & DSH-3 : Mise en page fixe à 4 zones principales */}
      <div
        data-testid="dashboard-layout"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1"
      >
        {/* Zone 1 (Moitié gauche) : Focus 5 — seule zone avec couleur d'accent forte */}
        <section
          aria-labelledby="focus5-heading"
          data-testid="zone-focus5"
          className="lg:col-span-7 flex flex-col justify-between rounded-xl border-2 border-blue-600 bg-blue-50/70 p-6 shadow-sm dark:border-blue-400 dark:bg-blue-950/40"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center rounded-lg bg-blue-600 p-2 text-white dark:bg-blue-500 dark:text-slate-950">
                  <Compass className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="focus5-heading"
                    className="text-lg font-bold text-slate-900 dark:text-slate-100"
                  >
                    {t.dashboard.focusZone.title}
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    {t.dashboard.focusZone.badge}
                  </span>
                </div>
              </div>

              <span
                data-testid="focus5-progress"
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white dark:bg-blue-400 dark:text-slate-950"
              >
                {t.dashboard.focusZone.progress}
              </span>
            </div>

            {/* État vide utile (Section 8 : un Focus vide affiche un bouton « Composer mon Focus ») */}
            <div className="my-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-blue-300 bg-white/80 p-8 text-center dark:border-blue-800 dark:bg-slate-900/80">
              <Sparkles
                className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3"
                aria-hidden="true"
              />
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {t.dashboard.focusZone.emptyTitle}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mb-5">
                {t.dashboard.focusZone.emptyDescription}
              </p>
              <button
                type="button"
                data-testid="compose-focus-btn"
                onClick={onComposeFocus}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
              >
                {t.dashboard.focusZone.composeButton}
              </button>
            </div>
          </div>
        </section>

        {/* Colonne de droite : Agenda du jour (Haut) + Prochaines échéances (Bas) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Zone 2 (Colonne droite haut) : Agenda du jour */}
          <section
            aria-labelledby="agenda-today-heading"
            data-testid="zone-today-agenda"
            className="flex-1 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar
                  className="h-5 w-5 text-slate-700 dark:text-slate-300"
                  aria-hidden="true"
                />
                <h2
                  id="agenda-today-heading"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {t.dashboard.agendaZone.title}
                </h2>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.dashboard.agendaZone.subtitle}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 py-4">
              {t.dashboard.agendaZone.empty}
            </p>
          </section>

          {/* Zone 3 (Colonne droite bas) : Prochaines échéances */}
          <section
            aria-labelledby="upcoming-deadlines-heading"
            data-testid="zone-upcoming-deadlines"
            className="flex-1 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock
                  className="h-5 w-5 text-slate-700 dark:text-slate-300"
                  aria-hidden="true"
                />
                <h2
                  id="upcoming-deadlines-heading"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {t.dashboard.deadlinesZone.title}
                </h2>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t.dashboard.deadlinesZone.subtitle}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 py-4">
              {t.dashboard.deadlinesZone.empty}
            </p>
          </section>
        </div>
      </div>

      {/* Zone 4 (Bande inférieure) : Raccourcis épinglés */}
      <section
        aria-labelledby="pinned-shortcuts-heading"
        data-testid="zone-pinned-shortcuts"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-slate-700 dark:text-slate-300" aria-hidden="true" />
            <h2
              id="pinned-shortcuts-heading"
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {t.dashboard.ShortcutsZone.title}
            </h2>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              — {t.dashboard.ShortcutsZone.subtitle}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
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
