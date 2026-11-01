import React, { useEffect, useState } from 'react';
import { CategoryRecord, getCategories } from '../lib/db';
import { useTranslations } from '../i18n';

export const TasksPage: React.FC = () => {
  const t = useTranslations();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

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

  return (
    <div data-testid="page-tasks" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.tasks.heading}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t.tasks.description}</p>
        </div>
      </header>

      <section
        aria-labelledby="categories-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          id="categories-heading"
          className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4"
        >
          {t.tasks.defaultCategoriesTitle}
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <li
              key={cat.id}
              data-testid={`category-card-${cat.alias}`}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-slate-100">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                  />
                  {cat.name}
                </span>
                {cat.is_system && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                    {t.tasks.systemBadge}
                  </span>
                )}
              </div>
              <span className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                #{cat.alias}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.tasks.emptyTasks}</p>
      </section>
    </div>
  );
};
