import React, { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { DbStatus, getCategories, getDbStatus, ThemeMode } from '../lib/db';
import { useTranslations } from '../i18n';

export const SettingsPage: React.FC = () => {
  const t = useTranslations();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [categoryCount, setCategoryCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    Promise.all([getDbStatus(), getCategories()])
      .then(([status, categories]) => {
        if (!mounted) return;
        setDbStatus(status);
        setCategoryCount(categories.length);
      })
      .catch(() => {
        if (!mounted) return;
      });
    return () => {
      mounted = false;
    };
  }, []);

  const themeOptions: Array<{
    mode: ThemeMode;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'light',
      label: t.settings.appearance.light,
      hint: t.settings.appearance.lightHint,
      icon: <Sun className="h-5 w-5" aria-hidden="true" />,
    },
    {
      mode: 'dark',
      label: t.settings.appearance.dark,
      hint: t.settings.appearance.darkHint,
      icon: <Moon className="h-5 w-5" aria-hidden="true" />,
    },
    {
      mode: 'system',
      label: t.settings.appearance.system,
      hint: t.settings.appearance.systemHint,
      icon: <Monitor className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  return (
    <div data-testid="page-settings" className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.settings.heading}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.settings.description}</p>
      </header>

      {/* Sélecteur de thème Clair / Sombre / Système (ACC-2) */}
      <section
        aria-labelledby="appearance-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4">
          <h2
            id="appearance-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {t.settings.appearance.title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t.settings.appearance.description}
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label={t.settings.appearance.groupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {themeOptions.map((option) => {
            const isSelected = theme === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`theme-option-${option.mode}`}
                onClick={() => {
                  void setTheme(option.mode);
                }}
                className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900 dark:border-blue-400 dark:bg-blue-950/50 dark:text-slate-100'
                    : 'border-slate-200 bg-slate-50/60 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {option.icon}
                  <span>{option.label}</span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-300">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <p
          data-testid="active-theme-indicator"
          className="mt-4 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          {t.settings.appearance.activeTheme} <span className="font-mono">{theme}</span> (
          <span className="font-mono">{resolvedTheme}</span>)
        </p>
      </section>

      {/* État du socle SQLite local-first */}
      <section
        aria-labelledby="storage-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          id="storage-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3"
        >
          {t.settings.storage.title}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
            <dt className="text-xs text-slate-600 dark:text-slate-400">
              {t.settings.storage.schemaVersion}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100">
              v{dbStatus?.schema_version ?? 1}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
            <dt className="text-xs text-slate-600 dark:text-slate-400">
              {t.settings.storage.categoriesCount}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100">{categoryCount}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          {t.settings.storage.syncReady}
        </p>
      </section>
    </div>
  );
};
