import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useTranslations } from '../i18n';

export const AgendaPage: React.FC = () => {
  const t = useTranslations();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  return (
    <div data-testid="page-agenda" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
            {t.agenda.heading}
          </h1>
          <p className="text-sm text-secondary">{t.agenda.description}</p>
        </div>

        <div className="inline-flex rounded-full border border-subtle bg-surface p-1">
          <button
            type="button"
            data-testid="agenda-view-week"
            aria-pressed={viewMode === 'week'}
            onClick={() => setViewMode('week')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'week'
                ? 'bg-accent-primary text-accent-foreground'
                : 'text-secondary hover:bg-surface-muted'
            }`}
          >
            {t.agenda.viewWeek}
          </button>
          <button
            type="button"
            data-testid="agenda-view-month"
            aria-pressed={viewMode === 'month'}
            onClick={() => setViewMode('month')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'month'
                ? 'bg-accent-primary text-accent-foreground'
                : 'text-secondary hover:bg-surface-muted'
            }`}
          >
            {t.agenda.viewMonth}
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-subtle bg-surface p-10 text-center flex flex-col items-center">
        <span className="inline-flex items-center justify-center rounded-2xl bg-surface-muted p-4 text-primary mb-4">
          <Calendar className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary mb-3">
          {t.agenda.comingSoonBadge}
        </span>
        <h2 className="text-lg font-display font-bold text-primary mb-2">
          {t.agenda.comingSoonTitle}
        </h2>
        <p className="text-sm text-secondary max-w-lg">{t.agenda.comingSoonDescription}</p>
      </section>
    </div>
  );
};
