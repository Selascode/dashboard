import React from 'react';
import { Sun } from 'lucide-react';
import { useTranslations } from '../i18n';

interface BriefingPageProps {
  onClose: () => void;
}

export const BriefingPage: React.FC<BriefingPageProps> = ({ onClose }) => {
  const t = useTranslations();

  return (
    <div
      data-testid="page-briefing"
      className="flex flex-col gap-6 max-w-3xl mx-auto py-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
            {t.briefing.heading}
          </h1>
          <p className="text-sm text-secondary">{t.briefing.description}</p>
        </div>

        <button
          type="button"
          data-testid="briefing-close-btn"
          onClick={onClose}
          className="rounded-full border border-subtle bg-surface px-4 py-2 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
        >
          {t.app.close} ({t.nav.shortcuts.escape})
        </button>
      </header>

      <section className="rounded-3xl border border-subtle bg-surface p-10 text-center flex flex-col items-center">
        <span className="inline-flex items-center justify-center rounded-2xl bg-surface-muted p-4 text-primary mb-4">
          <Sun className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary mb-3">
          {t.briefing.comingSoonBadge}
        </span>
        <h2 className="text-lg font-display font-bold text-primary mb-2">
          {t.briefing.comingSoonTitle}
        </h2>
        <p className="text-sm text-secondary max-w-lg mb-4">
          {t.briefing.comingSoonDescription}
        </p>
        <p className="text-xs text-muted">{t.briefing.closeHint}</p>
      </section>
    </div>
  );
};
