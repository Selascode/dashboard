import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Maximize2,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { UndoAction } from '../App';
import { useTheme } from '../context/ThemeContext';
import { formatTranslation, useTranslations } from '../i18n';
import {
  CategoryRecord,
  FocusItemRecord,
  TaskRecord,
  addFocusItem,
  completeTask,
  getCategories,
  listFocusItems,
  listTasks,
  listUncompletedPastFocusItems,
  removeFocusItem,
  reorderFocusItems,
} from '../lib/db';
import {
  NowModeSessionState,
  canAddTaskToFocus,
  computeFocusProgress,
  createNowModeSession,
  formatNowModeTimer,
  getUnfinishedPreviousFocusTasks,
  moveFocusItemInList,
  tickNowModeTimer,
} from '../lib/focus-engine';
import {
  formatDateByPreference,
  formatEditorialDateFr,
} from '../lib/quick-parser';

interface DashboardPageProps {
  onComposeFocus?: () => void;
  onNavigateAgenda?: () => void;
  onNavigateTasks?: () => void;
  onNavigateSettings?: () => void;
  onOpenBriefing?: () => void;
  onNewTask?: () => void;
  onPushUndo?: (action: UndoAction) => void;
}

const REFERENCE_TODAY = '2026-11-02';
const LONG_TEXT_THRESHOLD = 48;

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onComposeFocus,
  onNavigateAgenda,
  onNavigateTasks,
  onNavigateSettings,
  onOpenBriefing,
  onNewTask,
  onPushUndo,
}) => {
  const t = useTranslations();
  const { userName, dateFormat } = useTheme();

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [focusItems, setFocusItems] = useState<FocusItemRecord[]>([]);
  const [pastFocusItems, setPastFocusItems] = useState<FocusItemRecord[]>([]);
  const [focusLimitAlert, setFocusLimitAlert] = useState<string | null>(null);
  const [deadlinesFilter, setDeadlinesFilter] = useState<'upcoming' | 'overdue'>(
    'upcoming',
  );
  const [nowSession, setNowSession] = useState<NowModeSessionState | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const loadDashboardData = useCallback(async () => {
    const [loadedTasks, loadedCategories, loadedFocus, loadedPastFocus] =
      await Promise.all([
        listTasks(),
        getCategories(),
        listFocusItems(REFERENCE_TODAY),
        listUncompletedPastFocusItems(REFERENCE_TODAY),
      ]);
    setTasks(loadedTasks);
    setCategories(loadedCategories);
    setFocusItems(loadedFocus);
    setPastFocusItems(loadedPastFocus);
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!nowSession || !nowSession.isRunning) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setNowSession((prev) => {
        if (!prev || !prev.isRunning) {
          return prev;
        }
        const nextTick = tickNowModeTimer(prev.remainingSeconds, 1);
        return {
          ...prev,
          remainingSeconds: nextTick.remainingSeconds,
          isFinished: nextTick.isFinished,
          isRunning: !nextTick.isFinished,
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [nowSession]);

  const greetingText = userName.trim()
    ? formatTranslation(t.dashboard.greetingWithName, { name: userName.trim() })
    : t.dashboard.greetingWithoutName;

  const categoryById = new Map<string, CategoryRecord>(
    categories.map((c) => [c.id, c]),
  );
  const taskById = new Map<string, TaskRecord>(tasks.map((tk) => [tk.id, tk]));
  const focusTaskIds = new Set<string>(focusItems.map((item) => item.task_id));

  const focusEntries = focusItems
    .map((item) => {
      const task = taskById.get(item.task_id);
      return task ? { item, task } : null;
    })
    .filter((entry): entry is { item: FocusItemRecord; task: TaskRecord } =>
      Boolean(entry),
    );

  const focusProgress = computeFocusProgress(focusItems, taskById);

  const unfinishedPastEntries = getUnfinishedPreviousFocusTasks(
    [...focusItems, ...pastFocusItems],
    taskById,
    REFERENCE_TODAY,
  );

  const activeTodoTasks = tasks.filter(
    (tk) => tk.status !== 'done' && tk.status !== 'cancelled',
  );
  const overdueTasks = activeTodoTasks.filter(
    (tk) => tk.due_date !== null && tk.due_date < REFERENCE_TODAY,
  );
  const upcomingTasks = activeTodoTasks.filter(
    (tk) => tk.due_date !== null && tk.due_date >= REFERENCE_TODAY,
  );

  const displayedDeadlines =
    deadlinesFilter === 'overdue' ? overdueTasks : upcomingTasks;

  const handleToggleFocusTaskComplete = async (task: TaskRecord) => {
    const nextCompleted = task.status !== 'done';
    await completeTask(task.id, nextCompleted);
    await loadDashboardData();
    onPushUndo?.({
      kind: 'complete_task',
      description: task.title,
      undo: async () => {
        await completeTask(task.id, !nextCompleted);
        await loadDashboardData();
      },
      redo: async () => {
        await completeTask(task.id, nextCompleted);
        await loadDashboardData();
      },
    });
  };

  const handleMoveFocusItem = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= focusEntries.length) {
      return;
    }
    const previousOrderedIds = focusEntries.map((e) => e.task.id);
    const nextOrderedIds = moveFocusItemInList(
      previousOrderedIds,
      index,
      targetIndex,
    );
    await reorderFocusItems(REFERENCE_TODAY, nextOrderedIds);
    await loadDashboardData();
    onPushUndo?.({
      kind: 'reorder_focus',
      description: focusEntries[index].task.title,
      undo: async () => {
        await reorderFocusItems(REFERENCE_TODAY, previousOrderedIds);
        await loadDashboardData();
      },
      redo: async () => {
        await reorderFocusItems(REFERENCE_TODAY, nextOrderedIds);
        await loadDashboardData();
      },
    });
  };

  const handleAddTaskToFocus = async (task: TaskRecord) => {
    const validation = canAddTaskToFocus(focusItems, task, REFERENCE_TODAY);
    if (!validation.allowed) {
      setFocusLimitAlert(
        validation.reason === 'limit_reached'
          ? t.dashboard.focusZone.limitReached
          : (validation.messageFr ?? t.dashboard.focusZone.limitReached),
      );
      return;
    }
    try {
      await addFocusItem(REFERENCE_TODAY, task.id);
      setFocusLimitAlert(null);
      await loadDashboardData();
      onPushUndo?.({
        kind: 'toggle_focus',
        description: task.title,
        undo: async () => {
          await removeFocusItem(REFERENCE_TODAY, task.id);
          await loadDashboardData();
        },
        redo: async () => {
          await addFocusItem(REFERENCE_TODAY, task.id);
          await loadDashboardData();
        },
      });
    } catch {
      setFocusLimitAlert(t.dashboard.focusZone.limitReached);
    }
  };

  const handleRemoveFromFocus = async (taskId: string) => {
    const task = taskById.get(taskId);
    await removeFocusItem(REFERENCE_TODAY, taskId);
    await loadDashboardData();
    if (task) {
      onPushUndo?.({
        kind: 'toggle_focus',
        description: task.title,
        undo: async () => {
          await addFocusItem(REFERENCE_TODAY, taskId);
          await loadDashboardData();
        },
        redo: async () => {
          await removeFocusItem(REFERENCE_TODAY, taskId);
          await loadDashboardData();
        },
      });
    }
  };

  const openNowModeForTask = (task: TaskRecord) => {
    setNowSession(createNowModeSession(task));
  };

  const handleCompleteNowModeTask = async () => {
    if (!nowSession) {
      return;
    }
    const task = taskById.get(nowSession.taskId);
    if (!task) {
      setNowSession(null);
      return;
    }
    setNowSession(null);
    await completeTask(task.id, true);
    await loadDashboardData();
    onPushUndo?.({
      kind: 'complete_task',
      description: task.title,
      undo: async () => {
        await completeTask(task.id, false);
        await loadDashboardData();
      },
      redo: async () => {
        await completeTask(task.id, true);
        await loadDashboardData();
      },
    });
  };

  return (
    <div data-testid="page-dashboard" className="flex flex-col h-full gap-6">
      {/* En-tête éditorial */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium text-secondary mb-1">
            <Sun className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
            <span data-testid="dashboard-date-label">
              {formatEditorialDateFr(REFERENCE_TODAY)}
            </span>
          </div>
          <h1
            data-testid="dashboard-greeting-heading"
            className="text-3xl lg:text-[34px] leading-tight font-display font-bold tracking-tight text-primary"
          >
            {greetingText}
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            {t.dashboard.description}
          </p>
        </div>

        <button
          type="button"
          data-testid="dashboard-new-task-btn"
          onClick={onNewTask ?? onComposeFocus}
          className="focus-pill-control inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.app.newTaskButton}</span>
        </button>
      </header>

      {/* Mode Maintenant (FOC-4) en superposition plein cadre */}
      {nowSession && (
        <section
          data-testid="focus-now-mode"
          aria-label={t.dashboard.focusZone.nowModeHeading}
          className="rounded-3xl border border-subtle bg-surface p-8 shadow-sm flex flex-col items-center text-center gap-4"
        >
          <span className="rounded-full bg-surface-muted px-3.5 py-1 text-xs font-semibold text-secondary">
            {t.dashboard.focusZone.nowModeHeading}
          </span>
          <h2 className="text-2xl font-display font-bold text-primary max-w-xl">
            {nowSession.title}
          </h2>
          {nowSession.notes && (
            <p className="text-sm text-secondary max-w-md">{nowSession.notes}</p>
          )}
          <div
            data-testid="now-mode-timer-display"
            className="text-4xl font-mono font-bold text-primary my-2"
          >
            {formatNowModeTimer(nowSession.remainingSeconds)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="now-mode-toggle-timer-btn"
              onClick={() =>
                setNowSession((prev) =>
                  prev ? { ...prev, isRunning: !prev.isRunning } : null,
                )
              }
              className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2 text-xs font-semibold text-accent-foreground"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {nowSession.isRunning
                  ? t.dashboard.focusZone.nowModeTimerPause
                  : `${t.dashboard.focusZone.nowModeTimerStart} ${nowSession.durationMinutes} min`}
              </span>
            </button>
            <button
              type="button"
              data-testid="now-mode-complete-btn"
              onClick={() => {
                void handleCompleteNowModeTask();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface-muted px-4 py-2 text-xs font-semibold text-primary hover:bg-surface"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.dashboard.focusZone.nowModeComplete}</span>
            </button>
            <button
              type="button"
              data-testid="now-mode-reset-timer-btn"
              onClick={() =>
                setNowSession((prev) =>
                  prev
                    ? {
                        ...prev,
                        isRunning: false,
                        isFinished: false,
                        remainingSeconds: prev.totalSeconds,
                      }
                    : null,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-4 py-2 text-xs font-semibold text-primary hover:bg-surface-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.dashboard.focusZone.nowModeTimerReset}</span>
            </button>
            <button
              type="button"
              data-testid="now-mode-exit-btn"
              onClick={() => setNowSession(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-4 py-2 text-xs font-semibold text-secondary hover:text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.dashboard.focusZone.nowModeExit}</span>
            </button>
          </div>
        </section>
      )}

      {focusLimitAlert && (
        <div
          role="alert"
          data-testid="dashboard-focus-limit-alert"
          className="flex items-center justify-between rounded-2xl border border-danger bg-surface px-4 py-2.5 text-xs font-semibold text-danger"
        >
          <span>{focusLimitAlert}</span>
          <button
            type="button"
            onClick={() => setFocusLimitAlert(null)}
            aria-label={t.app.close}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* FOC-3 : Rétention des tâches du Focus de la veille non terminées */}
      {unfinishedPastEntries.length > 0 && (
        <section
          data-testid="unfinished-yesterday-focus-banner"
          aria-label={t.dashboard.focusZone.unfinishedPastTitle}
          className="rounded-3xl border border-subtle bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-subtle bg-surface-muted text-primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xs font-display font-bold text-primary">
                  {t.dashboard.focusZone.unfinishedPastTitle} (
                  {unfinishedPastEntries.length})
                </h2>
                <p className="text-[11px] text-secondary">
                  {t.dashboard.focusZone.unfinishedPastSubtitle}
                </p>
              </div>
            </div>
            {onOpenBriefing && (
              <button
                type="button"
                data-testid="unfinished-past-open-briefing-btn"
                onClick={onOpenBriefing}
                className="rounded-full border border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-primary hover:bg-surface transition-colors"
              >
                {t.dashboard.focusZone.openBriefingButton}
              </button>
            )}
          </div>
          <ul className="divide-y divide-subtle">
            {unfinishedPastEntries.map(({ task, previousFocusDay }) => (
              <li
                key={`${previousFocusDay}-${task.id}`}
                data-testid={`unfinished-past-focus-item-${task.id}`}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-primary truncate">
                    {task.title}
                  </span>
                  <span className="text-[11px] text-secondary shrink-0">
                    ({formatDateByPreference(previousFocusDay, dateFormat)})
                  </span>
                </div>
                <button
                  type="button"
                  data-testid={`resume-past-focus-btn-${task.id}`}
                  onClick={() => {
                    void handleAddTaskToFocus(task);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-primary px-3 py-1 text-[11px] font-semibold text-accent-foreground shrink-0"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>{t.dashboard.focusZone.resumeTaskButton}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* DSH-1 & DSH-3 : Mise en page fixe à 4 zones principales */}
      <div
        data-testid="dashboard-layout"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1"
      >
        {/* Zone 1 (Moitié gauche, 7 col) : Focus 5 */}
        <section
          aria-labelledby="focus5-heading"
          data-testid="zone-focus5"
          className="focus-card-surface lg:col-span-7 flex flex-col justify-between rounded-3xl p-7 min-h-[410px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-primary">
                <Scan className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="focus5-heading"
                  className="text-lg font-display font-bold text-primary leading-tight"
                >
                  {t.dashboard.focusZone.title}
                </h2>
                <p className="text-xs text-secondary">
                  {t.dashboard.focusZone.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {focusEntries.length > 0 && (
                <button
                  type="button"
                  data-testid="focus-now-mode-trigger"
                  onClick={() => openNowModeForTask(focusEntries[0].task)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface-muted px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.dashboard.focusZone.nowModeButton}</span>
                </button>
              )}
              <span
                data-testid="focus5-progress"
                className="focus-pill-control rounded-full px-3.5 py-1.5 text-xs"
              >
                <strong className="font-bold text-primary">
                  {focusProgress.ratioLabel}
                </strong>{' '}
                <span className="text-secondary">
                  {t.dashboard.focusZone.prioritiesSuffix}
                </span>
              </span>
            </div>
          </div>

          {focusEntries.length === 0 ? (
            /* État vide fidèle à docs/ui-reference.png */
            <div className="my-6 flex flex-col items-center justify-center text-center px-4">
              <div
                aria-hidden="true"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--bg-surface-muted) 65%, var(--bg-surface))',
                }}
                className="relative mb-5 flex h-32 w-32 items-center justify-center rounded-full border border-subtle"
              >
                <span className="absolute -left-1.5 bottom-7 h-2 w-2 rounded-full border border-subtle bg-surface-muted" />
                <span className="absolute -right-1.5 bottom-6 h-1.5 w-1.5 rounded-full border border-subtle bg-surface-muted" />
                <div
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--bg-surface-muted) 92%, var(--bg-surface))',
                  }}
                  className="flex h-24 w-24 items-center justify-center rounded-full border border-subtle"
                >
                  <div className="focus-card-surface flex h-14 w-14 -rotate-6 items-center justify-center rounded-2xl text-primary">
                    <Scan className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-display font-bold text-primary mb-2">
                {t.dashboard.focusZone.emptyTitle}
              </h3>
              <p className="text-xs text-secondary max-w-md leading-relaxed">
                {t.dashboard.focusZone.emptyDescription}
              </p>
              <p className="text-xs text-secondary max-w-md leading-relaxed mb-5">
                {t.dashboard.focusZone.emptySubDescription}
              </p>

              <button
                type="button"
                data-testid="compose-focus-btn"
                onClick={onComposeFocus}
                className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.dashboard.focusZone.composeButton}</span>
              </button>
            </div>
          ) : (
            /* Liste active des priorités du Focus 5 (FOC-1, FOC-2) */
            <ul
              data-testid="focus5-task-list"
              className="my-4 divide-y divide-subtle flex-1 flex flex-col justify-center"
            >
              {focusEntries.map(({ item, task }, idx) => {
                const isDone =
                  item.outcome === 'completed' || task.status === 'done';
                const cat = categoryById.get(task.category_id);
                const catToken = cat?.color.startsWith('--')
                  ? `var(${cat.color})`
                  : 'var(--cat-1)';

                const isExpanded = expandedTaskIds.has(task.id);
                const subtitleText = [
                  task.notes,
                  task.estimated_minutes
                    ? `${task.estimated_minutes} min`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                const isLongText =
                  task.title.length > LONG_TEXT_THRESHOLD ||
                  subtitleText.length > LONG_TEXT_THRESHOLD;

                return (
                  <li
                    key={item.id}
                    data-testid={`focus-item-${task.id}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={task.title}
                        data-testid={`focus-checkbox-${task.id}`}
                        onClick={() => {
                          void handleToggleFocusTaskComplete(task);
                        }}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isDone
                            ? 'border-accent-primary bg-accent-primary text-accent-foreground'
                            : 'border-subtle bg-surface hover:border-accent-primary'
                        }`}
                      >
                        {isDone && <Check className="h-3 w-3" aria-hidden="true" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          data-testid={`focus-item-title-${task.id}`}
                          className={`text-sm font-semibold ${
                            isExpanded ? 'whitespace-normal break-words' : 'line-clamp-1'
                          } ${isDone ? 'line-through text-muted' : 'text-primary'}`}
                        >
                          {task.title}
                        </p>
                        {subtitleText && (
                          <p
                            data-testid={`focus-item-subtitle-${task.id}`}
                            className={`text-xs text-secondary ${
                              isExpanded ? 'whitespace-normal break-words' : 'line-clamp-1'
                            }`}
                          >
                            {subtitleText}
                          </p>
                        )}
                        {isLongText && (
                          <button
                            type="button"
                            data-testid={`focus-expand-btn-${task.id}`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleTaskExpand(task.id)}
                            className="mt-1 inline-flex items-center text-[11px] font-semibold text-secondary hover:text-primary transition-colors"
                          >
                            {isExpanded ? t.tasks.seeLess : t.tasks.seeMore}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cat && (
                        <span
                          style={
                            {
                              '--badge-cat-color': catToken,
                            } as React.CSSProperties
                          }
                          className="category-badge-surface inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: catToken }}
                            aria-hidden="true"
                          />
                          {cat.name}
                        </span>
                      )}

                      <button
                        type="button"
                        data-testid={`focus-move-up-${task.id}`}
                        aria-label={t.dashboard.focusZone.moveUp}
                        disabled={idx === 0}
                        onClick={() => {
                          void handleMoveFocusItem(idx, -1);
                        }}
                        className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        data-testid={`focus-move-down-${task.id}`}
                        aria-label={t.dashboard.focusZone.moveDown}
                        disabled={idx === focusEntries.length - 1}
                        onClick={() => {
                          void handleMoveFocusItem(idx, 1);
                        }}
                        className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        data-testid={`focus-remove-${task.id}`}
                        aria-label={t.dashboard.focusZone.removeFromFocus}
                        onClick={() => {
                          void handleRemoveFromFocus(task.id);
                        }}
                        className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pied de carte Focus 5 : 5 segments de progression + devise */}
          <div className="pt-4 border-t border-subtle flex items-center justify-between gap-4">
            <div
              data-testid="focus5-segments"
              aria-hidden="true"
              className="flex items-center gap-1.5"
            >
              {focusProgress.segments.map((seg) => (
                <span
                  key={seg.index}
                  data-state={seg.state}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    seg.state === 'completed'
                      ? 'bg-accent-primary'
                      : 'bg-surface-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-secondary">
              {t.dashboard.focusZone.footerMotto}
            </span>
          </div>
        </section>

        {/* Colonne de droite (5 col) : Agenda du jour + Prochaines échéances */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Zone 2 : Agenda du jour */}
          <section
            aria-labelledby="agenda-today-heading"
            data-testid="zone-today-agenda"
            className="focus-card-surface flex-1 flex flex-col justify-between rounded-3xl p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-2.5">
                  <Calendar
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <h2
                    id="agenda-today-heading"
                    className="text-base font-display font-bold text-primary"
                  >
                    {t.dashboard.agendaZone.title}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface-muted px-3 py-1 text-[11px] font-medium text-secondary">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  <span>{t.dashboard.agendaZone.subtitle}</span>
                </span>
              </div>

              <div className="flex items-start gap-3.5 my-2">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-secondary">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">
                    {t.dashboard.agendaZone.emptyTitle}
                  </p>
                  <p className="text-xs text-secondary leading-relaxed">
                    {t.dashboard.agendaZone.empty}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-subtle">
              <button
                type="button"
                data-testid="dashboard-open-agenda-link"
                onClick={onNavigateAgenda}
                className="w-full flex items-center justify-between text-xs font-medium text-primary hover:opacity-80 transition-opacity"
              >
                <span>{t.dashboard.agendaZone.openLink}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* Zone 3 : Prochaines échéances */}
          <section
            aria-labelledby="upcoming-deadlines-heading"
            data-testid="zone-upcoming-deadlines"
            className="focus-card-surface flex-1 flex flex-col justify-between rounded-3xl p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2
                    id="upcoming-deadlines-heading"
                    className="text-base font-display font-bold text-primary"
                  >
                    {t.dashboard.deadlinesZone.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={t.dashboard.deadlinesZone.openTasksAria}
                  onClick={onNavigateTasks}
                  className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Pilules de filtre À venir / En retard */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  data-testid="deadlines-filter-upcoming"
                  onClick={() => setDeadlinesFilter('upcoming')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    deadlinesFilter === 'upcoming'
                      ? 'border border-subtle bg-surface-muted text-primary'
                      : 'text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {t.dashboard.deadlinesZone.upcomingTab}{' '}
                  <span className="ml-1 font-normal text-secondary">
                    {upcomingTasks.length}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="deadlines-filter-overdue"
                  onClick={() => setDeadlinesFilter('overdue')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    deadlinesFilter === 'overdue'
                      ? overdueTasks.length > 0
                        ? 'border border-danger bg-surface-muted text-danger'
                        : 'border border-subtle bg-surface-muted text-primary'
                      : overdueTasks.length > 0
                        ? 'border border-danger text-danger'
                        : 'text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {t.dashboard.deadlinesZone.overdueTab}{' '}
                  <span
                    className={`ml-1 font-normal ${
                      overdueTasks.length > 0 ? 'text-danger font-semibold' : 'text-secondary'
                    }`}
                  >
                    {overdueTasks.length}
                  </span>
                </button>
              </div>

              {displayedDeadlines.length === 0 ? (
                <div className="flex items-center gap-3.5 my-2">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-subtle bg-surface-muted text-secondary">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-primary mb-0.5">
                      {t.dashboard.deadlinesZone.emptyTitle}
                    </p>
                    <p className="text-xs text-secondary">
                      {t.dashboard.deadlinesZone.empty}
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-subtle">
                  {displayedDeadlines.slice(0, 3).map((tk) => {
                    const isOverdue =
                      tk.due_date !== null && tk.due_date < REFERENCE_TODAY;
                    const isInFocus = focusTaskIds.has(tk.id);
                    return (
                      <li
                        key={tk.id}
                        data-testid={`deadline-item-${tk.id}`}
                        className="flex items-center justify-between gap-2 py-2 text-xs"
                      >
                        <span className="font-medium text-primary line-clamp-1">
                          {tk.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            data-testid={`deadline-date-${tk.id}`}
                            className={`font-medium ${
                              isOverdue
                                ? 'text-danger border border-danger rounded-full px-2 py-0.5 font-semibold'
                                : 'text-secondary'
                            }`}
                          >
                            {tk.due_date === REFERENCE_TODAY
                              ? t.tasks.dueToday
                              : formatDateByPreference(tk.due_date, dateFormat)}
                          </span>
                          {!isInFocus && (
                            <button
                              type="button"
                              data-testid={`deadline-add-focus-${tk.id}`}
                              aria-label={t.dashboard.focusZone.addToFocus}
                              title={t.dashboard.focusZone.addToFocus}
                              onClick={() => {
                                void handleAddTaskToFocus(tk);
                              }}
                              className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
                            >
                              <Scan className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Zone 4 (Bande inférieure) : Raccourcis épinglés */}
      <section
        aria-labelledby="pinned-shortcuts-heading"
        data-testid="zone-pinned-shortcuts"
        className="focus-card-surface rounded-3xl p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2
              id="pinned-shortcuts-heading"
              className="text-base font-display font-bold text-primary"
            >
              {t.dashboard.ShortcutsZone.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onNavigateSettings}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            <span>{t.dashboard.ShortcutsZone.manageLink}</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onNavigateSettings}
              aria-label={t.dashboard.ShortcutsZone.pinButton}
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--bg-surface-muted) 55%, var(--bg-surface))',
              }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-subtle text-secondary hover:text-primary transition-colors"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
            <div>
              <p className="text-xs font-semibold text-primary mb-1">
                {t.dashboard.ShortcutsZone.emptyTitle}
              </p>
              <p className="text-xs text-secondary">
                {t.dashboard.ShortcutsZone.empty}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="pin-tool-btn"
            onClick={onNavigateSettings}
            className="focus-pill-control inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.dashboard.ShortcutsZone.pinButton}</span>
          </button>
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
