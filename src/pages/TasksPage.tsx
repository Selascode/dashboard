import React, { useEffect, useRef, useState } from 'react';
import { UndoAction } from '../App';
import { CategoryRecord, getCategories } from '../lib/db';
import { useTranslations } from '../i18n';

export interface TasksPageProps {
  quickAddFocusTrigger?: number;
  prefillText?: string | null;
  onClearPrefill?: () => void;
  initialSelectedTaskId?: string | null;
  onNavigateSettings?: () => void;
  onPushUndo?: (action: UndoAction) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  quickAddFocusTrigger = 0,
  prefillText,
  onClearPrefill,
}) => {
  const t = useTranslations();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [quickInputValue, setQuickInputValue] = useState('');
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((records) => {
        if (mounted) {
          setCategories(records);
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (quickAddFocusTrigger > 0) {
      quickInputRef.current?.focus();
    }
  }, [quickAddFocusTrigger]);

  useEffect(() => {
    if (prefillText) {
      setQuickInputValue(prefillText);
      quickInputRef.current?.focus();
      onClearPrefill?.();
    }
  }, [prefillText, onClearPrefill]);

  return (
    <div data-testid="page-tasks" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
            {t.tasks.heading}
          </h1>
          <p className="text-sm text-secondary">{t.tasks.description}</p>
        </div>
      </header>

      <section
        aria-labelledby="categories-heading"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <h2
          id="categories-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted mb-4"
        >
          {t.tasks.categoriesSectionTitle}
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => {
            const tokenVar = cat.color.startsWith('--')
              ? `var(${cat.color})`
              : 'var(--cat-1)';
            return (
              <li
                key={cat.id}
                data-testid={`category-card-${cat.alias}`}
                className="flex flex-col justify-between rounded-2xl border border-subtle bg-surface-muted p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-sm text-primary">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tokenVar }}
                      aria-hidden="true"
                    />
                    {cat.name}
                  </span>
                  {cat.is_system && (
                    <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-secondary">
                      {t.tasks.systemBadge}
                    </span>
                  )}
                </div>
                <span className="mt-2 text-xs font-mono text-secondary">
                  #{cat.alias}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-3xl border border-subtle bg-surface p-6">
        <div className="flex items-center justify-between gap-3 border-t border-subtle pt-4">
          <input
            ref={quickInputRef}
            type="text"
            data-testid="tasks-quick-add-input"
            value={quickInputValue}
            onChange={(e) => setQuickInputValue(e.target.value)}
            placeholder={t.tasks.addTaskPlaceholder}
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none"
          />
          <kbd className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-mono text-secondary">
            {t.nav.shortcuts.quickAdd}
          </kbd>
        </div>
      </section>
    </div>
  );
};
