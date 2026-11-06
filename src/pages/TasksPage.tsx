import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Scan,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { UndoAction } from '../App';
import { useTheme } from '../context/ThemeContext';
import { formatTranslation, useTranslations } from '../i18n';
import {
  CategoryRecord,
  FocusItemRecord,
  TaskRecord,
  TaskStatus,
  addFocusItem,
  completeTask,
  createTask,
  deleteTask,
  getCategories,
  listFocusItems,
  listTasks,
  removeFocusItem,
  restoreTask,
  updateTask,
} from '../lib/db';
import {
  formatDateByPreference,
  formatDueDateDisplay,
  formatDurationShort,
  formatEditorialDateFr,
  getQuickCaptureDateExample,
  parseQuickCapture,
} from '../lib/quick-parser';
import { canAddTaskToFocus } from '../lib/focus-engine';

export interface TasksPageProps {
  quickAddFocusTrigger?: number;
  prefillText?: string | null;
  onClearPrefill?: () => void;
  initialSelectedTaskId?: string | null;
  onNavigateSettings?: () => void;
  onPushUndo?: (action: UndoAction) => void;
}

const REFERENCE_TODAY = '2026-11-02';
const LONG_TEXT_THRESHOLD = 48;

export const TasksPage: React.FC<TasksPageProps> = ({
  quickAddFocusTrigger = 0,
  prefillText,
  onClearPrefill,
  initialSelectedTaskId = null,
  onNavigateSettings,
  onPushUndo,
}) => {
  const t = useTranslations();
  const {
    dateFormat,
    quickCapturePanelCollapsed: isRightPanelCollapsed,
    setQuickCapturePanelCollapsed,
  } = useTheme();

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [focusItems, setFocusItems] = useState<FocusItemRecord[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [statusTab, setStatusTab] = useState<'todo' | 'done'>('todo');
  const [viewMode, setViewMode] = useState<'list' | 'categories'>('list');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority'>('due_date');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSelectedTaskId,
  );
  const [quickInputValue, setQuickInputValue] = useState<string>('');
  const [focusErrorBanner, setFocusErrorBanner] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );

  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const expandRightPanelIfNeeded = useCallback(() => {
    if (isRightPanelCollapsed) {
      void setQuickCapturePanelCollapsed(false);
    }
  }, [isRightPanelCollapsed, setQuickCapturePanelCollapsed]);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      expandRightPanelIfNeeded();
    },
    [expandRightPanelIfNeeded],
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

  const loadData = useCallback(async () => {
    const [loadedCategories, loadedTasks, loadedFocus] = await Promise.all([
      getCategories(),
      listTasks(),
      listFocusItems(REFERENCE_TODAY),
    ]);
    setCategories(loadedCategories);
    setTasks(loadedTasks);
    setFocusItems(loadedFocus);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (initialSelectedTaskId) {
      setSelectedTaskId(initialSelectedTaskId);
      expandRightPanelIfNeeded();
    }
  }, [initialSelectedTaskId, expandRightPanelIfNeeded]);

  useEffect(() => {
    if (quickAddFocusTrigger > 0) {
      expandRightPanelIfNeeded();
      quickInputRef.current?.focus();
    }
  }, [quickAddFocusTrigger, expandRightPanelIfNeeded]);

  useEffect(() => {
    if (prefillText) {
      expandRightPanelIfNeeded();
      setQuickInputValue(prefillText);
      quickInputRef.current?.focus();
      onClearPrefill?.();
    }
  }, [prefillText, onClearPrefill, expandRightPanelIfNeeded]);

  const categoryById = useMemo(
    () => new Map<string, CategoryRecord>(categories.map((c) => [c.id, c])),
    [categories],
  );

  const focusTaskIds = useMemo(
    () => new Set<string>(focusItems.map((f) => f.task_id)),
    [focusItems],
  );

  const todoTasks = useMemo(
    () => tasks.filter((tk) => tk.status !== 'done' && tk.status !== 'cancelled'),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((tk) => tk.status === 'done'),
    [tasks],
  );

  const categoryTodoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tk of todoTasks) {
      counts.set(tk.category_id, (counts.get(tk.category_id) ?? 0) + 1);
    }
    return counts;
  }, [todoTasks]);

  const filteredTasks = useMemo(() => {
    const base = statusTab === 'done' ? doneTasks : todoTasks;
    const byCat =
      selectedCategoryId === 'all'
        ? base
        : base.filter((tk) => tk.category_id === selectedCategoryId);
    const q = searchQuery.trim().toLowerCase();
    const bySearch = q
      ? byCat.filter(
          (tk) =>
            tk.title.toLowerCase().includes(q) ||
            tk.notes.toLowerCase().includes(q),
        )
      : byCat;

    return [...bySearch].sort((a, b) => {
      if (sortBy === 'priority') {
        if (b.priority !== a.priority) return b.priority - a.priority;
      }
      if (a.due_date === null && b.due_date !== null) return 1;
      if (a.due_date !== null && b.due_date === null) return -1;
      if (
        a.due_date !== null &&
        b.due_date !== null &&
        a.due_date !== b.due_date
      ) {
        return a.due_date.localeCompare(b.due_date);
      }
      return b.priority - a.priority;
    });
  }, [doneTasks, searchQuery, selectedCategoryId, sortBy, statusTab, todoTasks]);

  const groupedTasks = useMemo(() => {
    const todayAndOverdue: TaskRecord[] = [];
    const upcoming: TaskRecord[] = [];
    const noDueDate: TaskRecord[] = [];

    for (const tk of filteredTasks) {
      if (!tk.due_date) {
        noDueDate.push(tk);
      } else if (tk.due_date <= REFERENCE_TODAY) {
        todayAndOverdue.push(tk);
      } else {
        upcoming.push(tk);
      }
    }

    return {
      todayAndOverdue,
      upcoming,
      noDueDate,
    };
  }, [filteredTasks]);

  const selectedTask = useMemo(
    () => tasks.find((tk) => tk.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const livePreview = useMemo(() => {
    if (!quickInputValue.trim()) {
      return null;
    }
    return parseQuickCapture(quickInputValue, categories, {
      now: REFERENCE_TODAY,
      dateFormat,
    });
  }, [categories, dateFormat, quickInputValue]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInputValue.trim()) {
      return;
    }
    const parsed = parseQuickCapture(quickInputValue, categories, {
      now: REFERENCE_TODAY,
      dateFormat,
    });
    const fallbackCategory =
      selectedCategoryId !== 'all' ? selectedCategoryId : 'cat-inbox';

    const created = await createTask({
      title: parsed.title,
      category_id: parsed.categoryId ?? fallbackCategory,
      due_date: parsed.dueDate,
      priority: parsed.priority,
      estimated_minutes: parsed.estimatedMinutes,
      status: 'todo',
    });

    if (parsed.addToFocus) {
      const validation = canAddTaskToFocus(focusItems, created, REFERENCE_TODAY);
      if (!validation.allowed) {
        setFocusErrorBanner(t.dashboard.focusZone.limitReached);
      } else {
        try {
          await addFocusItem(REFERENCE_TODAY, created.id);
          setFocusErrorBanner(null);
        } catch {
          setFocusErrorBanner(t.dashboard.focusZone.limitReached);
        }
      }
    }

    setQuickInputValue('');
    await loadData();
    handleSelectTask(created.id);
  };

  const handleToggleComplete = async (task: TaskRecord) => {
    const nextDone = task.status !== 'done';
    await completeTask(task.id, nextDone);
    await loadData();
    onPushUndo?.({
      kind: 'complete_task',
      description: task.title,
      undo: async () => {
        await completeTask(task.id, !nextDone);
        await loadData();
      },
      redo: async () => {
        await completeTask(task.id, nextDone);
        await loadData();
      },
    });
  };

  const handleDeleteTask = async (task: TaskRecord) => {
    await deleteTask(task.id);
    if (selectedTaskId === task.id) {
      setSelectedTaskId(null);
    }
    await loadData();
    onPushUndo?.({
      kind: 'delete_task',
      description: task.title,
      undo: async () => {
        await restoreTask(task.id);
        await loadData();
      },
      redo: async () => {
        await deleteTask(task.id);
        await loadData();
      },
    });
  };

  const handleToggleFocus = async (task: TaskRecord) => {
    const isCurrentlyInFocus = focusTaskIds.has(task.id);
    if (!isCurrentlyInFocus) {
      const validation = canAddTaskToFocus(focusItems, task, REFERENCE_TODAY);
      if (!validation.allowed) {
        setFocusErrorBanner(t.dashboard.focusZone.limitReached);
        return;
      }
    }
    try {
      if (isCurrentlyInFocus) {
        await removeFocusItem(REFERENCE_TODAY, task.id);
      } else {
        await addFocusItem(REFERENCE_TODAY, task.id);
      }
      setFocusErrorBanner(null);
      await loadData();
      onPushUndo?.({
        kind: 'toggle_focus',
        description: task.title,
        undo: async () => {
          if (isCurrentlyInFocus) {
            await addFocusItem(REFERENCE_TODAY, task.id);
          } else {
            await removeFocusItem(REFERENCE_TODAY, task.id);
          }
          await loadData();
        },
      });
    } catch {
      setFocusErrorBanner(t.dashboard.focusZone.limitReached);
    }
  };

  const renderTaskRow = (task: TaskRecord) => {
    const cat = categoryById.get(task.category_id);
    const catToken = cat?.color.startsWith('--')
      ? `var(${cat.color})`
      : 'var(--cat-1)';
    const isDone = task.status === 'done';
    const isInFocus = focusTaskIds.has(task.id);
    const isOverdue =
      !isDone && task.due_date !== null && task.due_date < REFERENCE_TODAY;
    const isSelected = selectedTaskId === task.id;
    const isExpanded = expandedTaskIds.has(task.id);
    const durationText = formatDurationShort(task.estimated_minutes);
    const subtitleParts = [task.notes, durationText].filter(Boolean);
    const subtitleText = subtitleParts.join(' · ');
    const isLongText =
      task.title.length > LONG_TEXT_THRESHOLD ||
      subtitleText.length > LONG_TEXT_THRESHOLD;
    const dateLabel = formatDueDateDisplay(
      task.due_date,
      REFERENCE_TODAY,
      {
        today: t.tasks.dueToday,
        toPlan: t.tasks.dueToPlan,
      },
      dateFormat,
    );

    return (
      <li
        key={task.id}
        data-testid={`task-row-${task.id}`}
        className={`flex items-center justify-between gap-3 py-3.5 px-2 rounded-2xl transition-colors ${
          isSelected ? 'bg-surface-muted' : 'hover:bg-surface-muted'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={isDone}
            aria-label={task.title}
            data-testid={`task-checkbox-${task.id}`}
            onClick={() => {
              void handleToggleComplete(task);
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
            <button
              type="button"
              data-testid={`task-select-${task.id}`}
              onClick={() => handleSelectTask(task.id)}
              className="w-full text-left focus:outline-none"
            >
              <p
                data-testid={`task-title-${task.id}`}
                className={`text-sm font-semibold ${
                  isExpanded
                    ? 'whitespace-normal break-words'
                    : 'line-clamp-1'
                } ${isDone ? 'line-through text-muted' : 'text-primary'}`}
              >
                {task.title}
              </p>
              {subtitleParts.length > 0 && (
                <p
                  data-testid={`task-subtitle-${task.id}`}
                  className={`text-xs text-secondary mt-0.5 ${
                    isExpanded
                      ? 'whitespace-normal break-words'
                      : 'line-clamp-1'
                  }`}
                >
                  {subtitleText}
                </p>
              )}
            </button>

            {isLongText && (
              <button
                type="button"
                data-testid={`task-expand-btn-${task.id}`}
                aria-expanded={isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskExpand(task.id);
                }}
                className="mt-1 inline-flex items-center text-[11px] font-semibold text-secondary hover:text-primary transition-colors"
              >
                {isExpanded ? t.tasks.seeLess : t.tasks.seeMore}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isInFocus && (
            <span
              title={t.dashboard.focusZone.title}
              data-testid={`task-focus-indicator-${task.id}`}
              className="inline-flex items-center justify-center text-primary"
            >
              <Scan className="h-4 w-4" aria-hidden="true" />
            </span>
          )}

          <div className="flex flex-col items-end gap-1 min-w-[78px]">
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
                <span>{cat.name}</span>
              </span>
            )}
            <span
              data-testid={`task-due-label-${task.id}`}
              className={`text-[11px] ${
                isOverdue
                  ? 'text-danger font-semibold'
                  : 'text-secondary font-medium'
              }`}
            >
              {isOverdue ? `${t.tasks.overduePrefix} ${dateLabel}` : dateLabel}
            </span>
          </div>

          <button
            type="button"
            aria-label={t.tasks.taskActionsAria}
            onClick={() => handleSelectTask(task.id)}
            className="rounded-lg p-1 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div data-testid="page-tasks" className="flex flex-col gap-6">
      {/* En-tête éditorial fidèle à docs/ui-tasks-reference.png */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium text-secondary mb-1">
            <Sun className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
            <span>{formatEditorialDateFr(REFERENCE_TODAY)}</span>
          </div>
          <h1 className="text-3xl lg:text-[34px] leading-tight font-display font-bold tracking-tight text-primary">
            {t.tasks.heading}
          </h1>
          <p className="text-sm text-secondary mt-0.5">{t.tasks.description}</p>
        </div>

        <button
          type="button"
          data-testid="tasks-header-new-btn"
          onClick={() => {
            expandRightPanelIfNeeded();
            quickInputRef.current?.focus();
          }}
          className="focus-pill-control inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.app.newTaskButton}</span>
        </button>
      </header>

      {/* Rangée de catégories en pilules larges (Toutes, Inbox, École, Sport, Perso, Projets) */}
      <section aria-labelledby="categories-heading" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="categories-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-secondary"
          >
            {t.tasks.categoriesSectionTitle}
          </h2>
          <button
            type="button"
            onClick={onNavigateSettings}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            <span>{t.tasks.manageCategories}</span>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <li>
            <button
              type="button"
              data-testid="category-card-all"
              onClick={() => setSelectedCategoryId('all')}
              className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                selectedCategoryId === 'all'
                  ? 'border-accent-primary bg-accent-primary text-accent-foreground shadow-sm'
                  : 'focus-card-surface text-primary hover:bg-surface-muted'
              }`}
            >
              <span>{t.tasks.allCategories}</span>
              <span
                className={`text-xs font-medium ${
                  selectedCategoryId === 'all'
                    ? 'text-accent-foreground'
                    : 'text-secondary'
                }`}
              >
                {todoTasks.length}
              </span>
            </button>
          </li>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const tokenVar = cat.color.startsWith('--')
              ? `var(${cat.color})`
              : 'var(--cat-1)';
            const count = categoryTodoCounts.get(cat.id) ?? 0;

            return (
              <li key={cat.id}>
                <button
                  type="button"
                  data-testid={`category-card-${cat.alias}`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'border-accent-primary bg-accent-primary text-accent-foreground shadow-sm'
                      : 'focus-card-surface text-primary hover:bg-surface-muted'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tokenVar }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? 'text-accent-foreground' : 'text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {focusErrorBanner && (
        <div
          role="alert"
          data-testid="focus-limit-alert"
          className="flex items-center justify-between rounded-2xl border border-danger bg-surface px-4 py-2.5 text-xs font-semibold text-danger"
        >
          <span>{focusErrorBanner}</span>
          <button
            type="button"
            onClick={() => setFocusErrorBanner(null)}
            aria-label={t.app.close}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Mise en page à deux colonnes : Carte "Mes tâches" à gauche + Détail / Rappel de syntaxe repliable à droite (Option B) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne de gauche : Carte "Mes tâches" (7 col si panneau ouvert, 11 col si panneau replié) */}
        <section
          aria-labelledby="my-tasks-heading"
          data-testid="tasks-main-card"
          className={`focus-card-surface ${
            isRightPanelCollapsed ? 'lg:col-span-11' : 'lg:col-span-7'
          } rounded-3xl p-6 flex flex-col gap-5 transition-all`}
        >
          {/* En-tête de la carte "Mes tâches" */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <h2
                id="my-tasks-heading"
                className="text-lg font-display font-bold text-primary"
              >
                {t.tasks.cardTitle}
              </h2>
              <span className="text-xs text-secondary">
                {todoTasks.length} {t.tasks.todoCountSuffix}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Bascule Liste / Catégories (TSK-6) */}
              <div className="inline-flex rounded-full border border-subtle bg-surface-muted p-1">
                <button
                  type="button"
                  data-testid="tasks-view-list"
                  aria-label={t.tasks.viewList}
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    viewMode === 'list'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="tasks-view-categories"
                  aria-label={t.tasks.viewCategories}
                  onClick={() => setViewMode('categories')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    viewMode === 'categories'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Bascule À faire / Terminées n */}
              <div className="inline-flex rounded-full border border-subtle bg-surface-muted p-1">
                <button
                  type="button"
                  data-testid="tasks-tab-todo"
                  onClick={() => setStatusTab('todo')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                    statusTab === 'todo'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t.tasks.tabTodo}
                </button>
                <button
                  type="button"
                  data-testid="tasks-tab-done"
                  onClick={() => setStatusTab('done')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                    statusTab === 'done'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t.tasks.tabDone} {doneTasks.length}
                </button>
              </div>
            </div>
          </div>

          {/* Barre de recherche et tri */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2.5 rounded-full border border-subtle bg-surface-muted px-4 py-2">
              <Search className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              <input
                type="text"
                data-testid="tasks-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.tasks.searchPlaceholder}
                className="w-full bg-transparent text-xs text-primary placeholder:text-secondary focus:outline-none"
              />
            </div>

            <button
              type="button"
              data-testid="tasks-sort-toggle"
              onClick={() =>
                setSortBy((prev) =>
                  prev === 'due_date' ? 'priority' : 'due_date',
                )
              }
              className="focus-pill-control inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-primary hover:bg-surface-muted transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              <span>
                {sortBy === 'due_date'
                  ? t.tasks.sortByDueDate
                  : t.tasks.sortByPriority}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
            </button>
          </div>

          {viewMode === 'categories' ? (
            /* Vue par catégories (TSK-6) : cartes colorées translucides avec top 3 tâches */
            <div
              data-testid="tasks-categories-grid"
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {categories.map((cat) => {
                const catToken = cat.color.startsWith('--')
                  ? `var(${cat.color})`
                  : 'var(--cat-1)';
                const catTasks = filteredTasks
                  .filter((tk) => tk.category_id === cat.id)
                  .slice(0, 3);

                return (
                  <div
                    key={cat.id}
                    style={
                      {
                        '--badge-cat-color': catToken,
                      } as React.CSSProperties
                    }
                    className="category-card-surface rounded-2xl border p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-display font-bold text-primary">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: catToken }}
                          aria-hidden="true"
                        />
                        {cat.name}
                      </span>
                      <span className="text-xs font-semibold text-secondary">
                        {categoryTodoCounts.get(cat.id) ?? 0}
                      </span>
                    </div>

                    {catTasks.length === 0 ? (
                      <p className="text-xs text-secondary py-2">
                        {t.dashboard.deadlinesZone.emptyTitle}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {catTasks.map((tk) => (
                          <li key={tk.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryId(cat.id);
                                setViewMode('list');
                                handleSelectTask(tk.id);
                              }}
                              className="w-full text-left text-xs font-medium text-primary line-clamp-1 hover:underline"
                            >
                              • {tk.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-secondary">{t.tasks.emptyTasks}</p>
            </div>
          ) : (
            /* Liste groupée fidèle à docs/ui-tasks-reference.png (Aujourd'hui, À venir, Sans échéance) */
            <div className="flex flex-col gap-5">
              {groupedTasks.todayAndOverdue.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <h3 className="text-xs font-display font-bold text-primary">
                      {t.tasks.groupToday}
                    </h3>
                    <span className="text-xs text-secondary">
                      {groupedTasks.todayAndOverdue.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-subtle">
                    {groupedTasks.todayAndOverdue.map(renderTaskRow)}
                  </ul>
                </div>
              )}

              {groupedTasks.upcoming.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <h3 className="text-xs font-display font-bold text-primary">
                      {t.tasks.groupUpcoming}
                    </h3>
                    <span className="text-xs text-secondary">
                      {groupedTasks.upcoming.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-subtle">
                    {groupedTasks.upcoming.map(renderTaskRow)}
                  </ul>
                </div>
              )}

              {groupedTasks.noDueDate.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <h3 className="text-xs font-display font-bold text-primary">
                      {t.tasks.groupNoDueDate}
                    </h3>
                    <span className="text-xs text-secondary">
                      {groupedTasks.noDueDate.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-subtle">
                    {groupedTasks.noDueDate.map(renderTaskRow)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Dernière ligne : "+ Ajouter une tâche…" avec indication de la touche N et aperçu en direct */}
          <form
            onSubmit={(e) => {
              void handleQuickAddSubmit(e);
            }}
            className="border-t border-subtle pt-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 flex-1">
                <Plus className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <input
                  ref={quickInputRef}
                  type="text"
                  data-testid="tasks-quick-add-input"
                  value={quickInputValue}
                  onChange={(e) => setQuickInputValue(e.target.value)}
                  placeholder={t.tasks.addTaskPlaceholder}
                  className="w-full bg-transparent text-xs text-primary placeholder:text-secondary focus:outline-none"
                />
              </span>
              <kbd className="rounded-md border border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-secondary">
                {t.nav.shortcuts.quickAdd}
              </kbd>
            </div>

            {livePreview && (
              <div
                data-testid="quick-syntax-live-preview"
                className="flex flex-wrap items-center gap-2 pl-6 text-[11px] text-secondary"
              >
                {livePreview.categoryName && (
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-semibold text-primary">
                    #{livePreview.categoryName}
                  </span>
                )}
                {livePreview.dueDate && (
                  <span
                    data-testid="quick-preview-due-badge"
                    className="rounded-full bg-surface-muted px-2.5 py-0.5 font-medium text-primary"
                  >
                    @{formatDateByPreference(livePreview.dueDate, dateFormat)}
                  </span>
                )}
                {livePreview.priority > 0 && (
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-semibold text-primary">
                    !{livePreview.priority}
                  </span>
                )}
                {livePreview.estimatedMinutes && (
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-medium text-primary">
                    ~{livePreview.estimatedMinutes}m
                  </span>
                )}
                {livePreview.addToFocus && (
                  <span className="rounded-full bg-accent-primary px-2.5 py-0.5 font-semibold text-accent-foreground">
                    ★ {t.dashboard.focusZone.title}
                  </span>
                )}
              </div>
            )}
          </form>
        </section>

        {/* Colonne de droite : Détail et édition OU Rappel de syntaxe et modèles (Option B : accordéon latéral repliable) */}
        <aside
          data-testid="tasks-right-panel"
          data-collapsed={isRightPanelCollapsed ? 'true' : 'false'}
          className={`focus-card-surface ${
            isRightPanelCollapsed
              ? 'lg:col-span-1 px-3.5 py-2.5 lg:px-2 lg:py-4 flex flex-row lg:flex-col items-center justify-between min-h-0 lg:min-h-[340px] overflow-hidden'
              : 'lg:col-span-5 p-4 sm:p-6 flex flex-col gap-5 overflow-hidden'
          } rounded-3xl transition-all`}
        >
          {isRightPanelCollapsed ? (
            <div
              data-testid="tasks-right-panel-collapsed-strip"
              onClick={() => {
                void setQuickCapturePanelCollapsed(false);
              }}
              className="flex flex-1 flex-row lg:flex-col items-center justify-between gap-2.5 lg:gap-4 w-full min-w-0 cursor-pointer"
            >
              <button
                type="button"
                data-testid="tasks-panel-expand-btn"
                aria-expanded={false}
                aria-label={t.tasks.expandPanel}
                title={t.tasks.expandPanel}
                onClick={(e) => {
                  e.stopPropagation();
                  void setQuickCapturePanelCollapsed(false);
                }}
                className="inline-flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-primary hover:border-accent-primary transition-colors"
              >
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              </button>

              <span
                data-testid="tasks-right-panel-collapsed-label"
                className="min-w-0 flex-1 lg:flex-none shrink-0 text-center [writing-mode:horizontal-tb] lg:[writing-mode:vertical-rl] text-[11px] lg:text-[10px] xl:text-[11px] font-semibold uppercase tracking-wide lg:tracking-wider leading-tight lg:leading-none text-secondary truncate lg:overflow-visible whitespace-nowrap lg:whitespace-nowrap lg:py-1 select-none"
              >
                {t.tasks.collapsedPanelLabel}
              </span>

              <span className="inline-flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-secondary">
                <Scan className="h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden="true" />
              </span>
            </div>
          ) : selectedTask ? (
            /* Panneau de détail et d'édition de la tâche sélectionnée (TSK-1, TSK-2) */
            <div data-testid="task-detail-panel" className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-primary">
                    <Scan className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-display font-bold text-primary">
                      {t.tasks.detailPanel.title}
                    </h2>
                    <p className="text-xs text-secondary">
                      {t.tasks.detailPanel.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="tasks-panel-collapse-btn"
                    aria-expanded={true}
                    aria-label={t.tasks.collapsePanel}
                    title={t.tasks.collapsePanel}
                    onClick={() => {
                      void setQuickCapturePanelCollapsed(true);
                    }}
                    className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
                  >
                    <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-testid="task-detail-close-btn"
                    onClick={() => setSelectedTaskId(null)}
                    aria-label={t.app.close}
                    className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                  <span>{t.tasks.detailPanel.fieldTitle}</span>
                  <input
                    type="text"
                    data-testid="detail-title-input"
                    value={selectedTask.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.trim()) {
                        void updateTask({
                          id: selectedTask.id,
                          title: val,
                        }).then(loadData);
                      }
                    }}
                    className="rounded-2xl border border-subtle bg-surface-muted px-3.5 py-2 text-sm font-medium text-primary"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                  <span>{t.tasks.detailPanel.fieldNotes}</span>
                  <textarea
                    rows={2}
                    data-testid="detail-notes-input"
                    value={selectedTask.notes}
                    placeholder={t.tasks.detailPanel.fieldNotesPlaceholder}
                    onChange={(e) => {
                      void updateTask({
                        id: selectedTask.id,
                        notes: e.target.value,
                      }).then(loadData);
                    }}
                    className="rounded-2xl border border-subtle bg-surface-muted px-3.5 py-2 text-xs text-primary placeholder:text-muted resize-none"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                    <span>{t.tasks.detailPanel.fieldCategory}</span>
                    <select
                      data-testid="detail-category-select"
                      value={selectedTask.category_id}
                      onChange={(e) => {
                        void updateTask({
                          id: selectedTask.id,
                          category_id: e.target.value,
                        }).then(loadData);
                      }}
                      className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-primary"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                    <span className="flex items-center justify-between gap-1">
                      <span>{t.tasks.detailPanel.fieldDueDate}</span>
                      {selectedTask.due_date && (
                        <span
                          data-testid="detail-duedate-formatted"
                          className="font-mono text-[11px] text-primary"
                        >
                          {formatDateByPreference(
                            selectedTask.due_date,
                            dateFormat,
                          )}
                        </span>
                      )}
                    </span>
                    <input
                      type="date"
                      data-testid="detail-duedate-input"
                      value={selectedTask.due_date ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        void updateTask({
                          id: selectedTask.id,
                          due_date: val || null,
                          clear_due_date: !val,
                        }).then(loadData);
                      }}
                      className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-primary"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                    <span>{t.tasks.detailPanel.fieldPriority}</span>
                    <select
                      data-testid="detail-priority-select"
                      value={selectedTask.priority}
                      onChange={(e) => {
                        void updateTask({
                          id: selectedTask.id,
                          priority: Number(e.target.value),
                        }).then(loadData);
                      }}
                      className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-primary"
                    >
                      <option value={0}>{t.tasks.priorityLabels.p0}</option>
                      <option value={1}>{t.tasks.priorityLabels.p1}</option>
                      <option value={2}>{t.tasks.priorityLabels.p2}</option>
                      <option value={3}>{t.tasks.priorityLabels.p3}</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                    <span>{t.tasks.detailPanel.fieldDuration}</span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      data-testid="detail-duration-input"
                      value={selectedTask.estimated_minutes ?? ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        void updateTask({
                          id: selectedTask.id,
                          estimated_minutes: val > 0 ? val : null,
                          clear_estimated_minutes: val <= 0,
                        }).then(loadData);
                      }}
                      className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-primary"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                    <span>{t.tasks.detailPanel.fieldStatus}</span>
                    <select
                      data-testid="detail-status-select"
                      value={selectedTask.status}
                      onChange={(e) => {
                        void updateTask({
                          id: selectedTask.id,
                          status: e.target.value as TaskStatus,
                        }).then(loadData);
                      }}
                      className="rounded-2xl border border-subtle bg-surface-muted px-3 py-2 text-xs font-medium text-primary"
                    >
                      <option value="todo">{t.tasks.statusLabels.todo}</option>
                      <option value="in_progress">
                        {t.tasks.statusLabels.in_progress}
                      </option>
                      <option value="done">{t.tasks.statusLabels.done}</option>
                      <option value="cancelled">
                        {t.tasks.statusLabels.cancelled}
                      </option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-subtle flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="detail-toggle-focus-btn"
                  onClick={() => {
                    void handleToggleFocus(selectedTask);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
                >
                  <Scan className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {focusTaskIds.has(selectedTask.id)
                      ? t.tasks.detailPanel.focusButtonRemove
                      : t.tasks.detailPanel.focusButtonAdd}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="detail-delete-task-btn"
                  onClick={() => {
                    void handleDeleteTask(selectedTask);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-3.5 py-2 text-xs font-semibold text-danger hover:bg-surface-muted transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.tasks.detailPanel.deleteTask}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Rappel de la syntaxe de saisie rapide & Modèles de saisie (CMD-3) quand aucune tâche n'est sélectionnée */
            <div data-testid="task-syntax-panel" className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-primary">
                    <Scan className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-display font-bold text-primary">
                      {t.tasks.syntaxPanel.title}
                    </h2>
                    <p className="text-xs text-secondary leading-relaxed mt-0.5">
                      {t.tasks.syntaxPanel.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="tasks-panel-collapse-btn"
                  aria-expanded={true}
                  aria-label={t.tasks.collapsePanel}
                  title={t.tasks.collapsePanel}
                  onClick={() => {
                    void setQuickCapturePanelCollapsed(true);
                  }}
                  className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors shrink-0"
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Exemple de syntaxe complet */}
              <div className="rounded-2xl border border-subtle bg-surface-muted p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary mb-1.5">
                  {t.tasks.syntaxPanel.exampleLabel}
                </p>
                <code className="block text-xs font-mono font-semibold text-primary break-words">
                  {t.tasks.syntaxPanel.exampleCode}
                </code>
              </div>

              {/* Liste des jetons reconnus */}
              <div>
                <h3 className="text-xs font-display font-bold text-primary mb-2.5">
                  {t.tasks.syntaxPanel.tokensTitle}
                </h3>
                <dl className="divide-y divide-subtle text-xs">
                  <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <dt className="font-mono font-semibold text-primary shrink-0">
                      {t.tasks.syntaxPanel.tokenCategory}
                    </dt>
                    <dd className="text-secondary sm:text-right break-words">
                      {t.tasks.syntaxPanel.tokenCategoryDesc}
                    </dd>
                  </div>
                  <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <dt className="font-mono font-semibold text-primary shrink-0">
                      {t.tasks.syntaxPanel.tokenDate}
                    </dt>
                    <dd
                      data-testid="syntax-token-date-desc"
                      className="text-secondary sm:text-right break-words"
                    >
                      {formatTranslation(t.tasks.syntaxPanel.tokenDateDesc, {
                        example: getQuickCaptureDateExample(dateFormat),
                      })}
                    </dd>
                  </div>
                  <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <dt className="font-mono font-semibold text-primary shrink-0">
                      {t.tasks.syntaxPanel.tokenPriority}
                    </dt>
                    <dd className="text-secondary sm:text-right break-words">
                      {t.tasks.syntaxPanel.tokenPriorityDesc}
                    </dd>
                  </div>
                  <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <dt className="font-mono font-semibold text-primary shrink-0">
                      {t.tasks.syntaxPanel.tokenDuration}
                    </dt>
                    <dd className="text-secondary sm:text-right break-words">
                      {t.tasks.syntaxPanel.tokenDurationDesc}
                    </dd>
                  </div>
                  <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <dt className="font-mono font-semibold text-primary shrink-0">
                      {t.tasks.syntaxPanel.tokenFocus}
                    </dt>
                    <dd className="text-secondary sm:text-right break-words">
                      {t.tasks.syntaxPanel.tokenFocusDesc}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Modèles de saisie rapide (CMD-3) */}
              <div className="pt-2 border-t border-subtle">
                <h3 className="text-xs font-display font-bold text-primary mb-1">
                  {t.tasks.syntaxPanel.templatesTitle}
                </h3>
                <p className="text-xs text-secondary mb-3">
                  {t.tasks.syntaxPanel.templatesSubtitle}
                </p>

                <div className="flex flex-col gap-2.5">
                  {[
                    t.tasks.syntaxPanel.templates.study,
                    t.tasks.syntaxPanel.templates.sport,
                    t.tasks.syntaxPanel.templates.project,
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      data-testid={`syntax-template-${tpl.label}`}
                      onClick={() => {
                        setQuickInputValue(tpl.template);
                        quickInputRef.current?.focus();
                      }}
                      className="w-full text-left rounded-2xl border border-subtle bg-surface-muted p-3 hover:border-accent-primary transition-colors flex flex-col gap-1"
                    >
                      <span className="flex items-center justify-between text-xs font-semibold text-primary">
                        <span>{tpl.label}</span>
                        <Plus className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-mono text-secondary truncate">
                        {tpl.template}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
