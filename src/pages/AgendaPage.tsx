import React, { useState } from 'react';
import { useTranslations } from '../i18n';

export const AgendaPage: React.FC = () => {
  const t = useTranslations();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  return (
    <div data-testid="page-agenda" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.agenda.heading}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t.agenda.description}</p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            data-testid="agenda-view-week"
            aria-pressed={viewMode === 'week'}
            onClick={() => setViewMode('week')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.agenda.viewWeek}
          </button>
          <button
            type="button"
            data-testid="agenda-view-month"
            aria-pressed={viewMode === 'month'}
            onClick={() => setViewMode('month')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.agenda.viewMonth}
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.agenda.emptySources}</p>
      </section>
    </div>
  );
};
