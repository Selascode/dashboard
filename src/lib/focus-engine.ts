import { FocusItemRecord, TaskRecord } from './db';

export const MAX_FOCUS_ITEMS = 5;
export const DEFAULT_NOW_TIMER_MINUTES = 25;

export type FocusAddRejectionReason =
  | 'limit_reached'
  | 'already_in_focus'
  | 'task_deleted'
  | 'task_completed';

export interface FocusValidationResult {
  allowed: boolean;
  reason?: FocusAddRejectionReason;
  messageFr?: string;
}

export type FocusSegmentState = 'completed' | 'pending' | 'empty';

export interface FocusProgressSegment {
  index: number;
  state: FocusSegmentState;
  taskId: string | null;
}

export interface FocusProgressSummary {
  completedCount: number;
  totalCount: number;
  maxSlots: 5;
  ratioLabel: string;
  completionPercent: number;
  segments: FocusProgressSegment[];
}

export interface UnfinishedPreviousFocusEntry {
  focusItem: FocusItemRecord;
  task: TaskRecord;
  previousFocusDay: string;
}

export interface NowModeSessionState {
  taskId: string;
  title: string;
  notes: string;
  durationMinutes: number;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
}

/**
 * Helper interne pour résoudre une tâche par son identifiant dans un Map ou un Record/tableau.
 */
function resolveTaskById(
  tasksSource:
    | ReadonlyMap<string, TaskRecord>
    | Readonly<Record<string, TaskRecord>>
    | readonly TaskRecord[],
  taskId: string,
): TaskRecord | undefined {
  if (tasksSource instanceof Map) {
    return tasksSource.get(taskId);
  }
  if (Array.isArray(tasksSource)) {
    return tasksSource.find((t) => t.id === taskId);
  }
  return (tasksSource as Readonly<Record<string, TaskRecord>>)[taskId];
}

/**
 * FOC-1 : Validation pure de l'ajout d'une tâche dans le Focus du jour.
 * - Refuse les tâches absentes ou supprimées logiquement (`deleted_at !== null`).
 * - Refuse les tâches déjà terminées ou annulées (`status === 'done' | 'cancelled'`).
 * - Refuse les doublons pour le même `focusDay`.
 * - Refuse strictement un 6e ajout (`activeItemsForDay.length >= 5`) avec un message explicite.
 */
export function canAddTaskToFocus(
  currentFocusItems: readonly FocusItemRecord[],
  task: TaskRecord | null | undefined,
  focusDay?: string,
): FocusValidationResult {
  if (!task || task.deleted_at !== null) {
    return {
      allowed: false,
      reason: 'task_deleted',
      messageFr: 'Impossible d’ajouter une tâche introuvable ou supprimée au Focus.',
    };
  }

  if (task.status === 'done' || task.status === 'cancelled') {
    return {
      allowed: false,
      reason: 'task_completed',
      messageFr: 'Cette tâche est déjà terminée ou annulée.',
    };
  }

  const activeItemsForDay = currentFocusItems.filter(
    (item) =>
      item.deleted_at === null &&
      (focusDay === undefined || item.focus_day === focusDay),
  );

  if (activeItemsForDay.some((item) => item.task_id === task.id)) {
    return {
      allowed: false,
      reason: 'already_in_focus',
      messageFr: 'Cette tâche figure déjà dans le Focus du jour.',
    };
  }

  if (activeItemsForDay.length >= MAX_FOCUS_ITEMS) {
    return {
      allowed: false,
      reason: 'limit_reached',
      messageFr:
        'Limite atteinte : Le Focus du jour ne peut pas contenir plus de 5 tâches.',
    };
  }

  return {
    allowed: true,
  };
}

/**
 * FOC-1 : Réordonne une liste d'identifiants de tâches en déplaçant l'élément de `fromIndex` vers `toIndex`.
 * Retourne un nouveau tableau sans muter l'entrée, plafonné à MAX_FOCUS_ITEMS (5).
 */
export function moveFocusItemInList(
  orderedTaskIds: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const uniqueIds = Array.from(new Set(orderedTaskIds)).slice(
    0,
    MAX_FOCUS_ITEMS,
  );
  if (
    uniqueIds.length <= 1 ||
    fromIndex < 0 ||
    fromIndex >= uniqueIds.length ||
    toIndex < 0 ||
    toIndex >= uniqueIds.length ||
    fromIndex === toIndex
  ) {
    return [...uniqueIds];
  }

  const next = [...uniqueIds];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * FOC-1 : Calcule les nouveaux enregistrements `FocusItemRecord` avec des positions continues `1..N`
 * (plafonnées à 5) à partir de l'ordre souhaité `orderedTaskIds`.
 */
export function computeReorderedFocusPositions(
  currentItems: readonly FocusItemRecord[],
  orderedTaskIds: readonly string[],
  updatedAtIso = new Date().toISOString(),
): FocusItemRecord[] {
  const activeItems = currentItems
    .filter((item) => item.deleted_at === null)
    .sort((a, b) => a.position - b.position);

  if (activeItems.length === 0) {
    return [];
  }

  const itemByTaskId = new Map<string, FocusItemRecord>();
  for (const item of activeItems) {
    if (!itemByTaskId.has(item.task_id)) {
      itemByTaskId.set(item.task_id, item);
    }
  }

  const orderedRecords: FocusItemRecord[] = [];
  const placedTaskIds = new Set<string>();

  for (const taskId of orderedTaskIds) {
    if (orderedRecords.length >= MAX_FOCUS_ITEMS) {
      break;
    }
    const found = itemByTaskId.get(taskId);
    if (found && !placedTaskIds.has(taskId)) {
      placedTaskIds.add(taskId);
      orderedRecords.push(found);
    }
  }

  for (const item of activeItems) {
    if (orderedRecords.length >= MAX_FOCUS_ITEMS) {
      break;
    }
    if (!placedTaskIds.has(item.task_id)) {
      placedTaskIds.add(item.task_id);
      orderedRecords.push(item);
    }
  }

  return orderedRecords.map((item, idx) => {
    const nextPosition = idx + 1;
    if (item.position === nextPosition) {
      return { ...item };
    }
    return {
      ...item,
      position: nextPosition,
      updated_at: updatedAtIso,
    };
  });
}

/**
 * FOC-2 : Calcule l'état d'avancement du Focus du jour (`X/5`, pourcentage et segments 1..5).
 * Une tâche du Focus est considérée comme terminée si `item.outcome === 'completed'`
 * ou si la tâche associée a `task.status === 'done'`.
 */
export function computeFocusProgress(
  focusItems: readonly FocusItemRecord[],
  tasksById:
    | ReadonlyMap<string, TaskRecord>
    | Readonly<Record<string, TaskRecord>>
    | readonly TaskRecord[],
): FocusProgressSummary {
  const activeFocusItems = focusItems
    .filter((item) => item.deleted_at === null)
    .sort((a, b) => a.position - b.position);

  const validEntries: Array<{
    item: FocusItemRecord;
    task: TaskRecord | undefined;
    isCompleted: boolean;
  }> = [];

  const seenTaskIds = new Set<string>();
  for (const item of activeFocusItems) {
    if (validEntries.length >= MAX_FOCUS_ITEMS) {
      break;
    }
    if (seenTaskIds.has(item.task_id)) {
      continue;
    }
    const task = resolveTaskById(tasksById, item.task_id);
    if (task && task.deleted_at !== null) {
      continue;
    }
    seenTaskIds.add(item.task_id);
    const isCompleted =
      item.outcome === 'completed' || Boolean(task && task.status === 'done');
    validEntries.push({ item, task, isCompleted });
  }

  const totalCount = validEntries.length;
  const completedCount = validEntries.filter((e) => e.isCompleted).length;
  const completionPercent = Math.round(
    (completedCount / MAX_FOCUS_ITEMS) * 100,
  );

  const segments: FocusProgressSegment[] = Array.from(
    { length: MAX_FOCUS_ITEMS },
    (_, idx) => {
      const entry = validEntries[idx];
      if (!entry) {
        return {
          index: idx + 1,
          state: 'empty',
          taskId: null,
        };
      }
      return {
        index: idx + 1,
        state: entry.isCompleted ? 'completed' : 'pending',
        taskId: entry.item.task_id,
      };
    },
  );

  return {
    completedCount,
    totalCount,
    maxSlots: MAX_FOCUS_ITEMS,
    ratioLabel: `${completedCount}/${MAX_FOCUS_ITEMS}`,
    completionPercent,
    segments,
  };
}

/**
 * FOC-3 : Identifie les tâches non terminées des Focus précédents (`focus_day < currentFocusDay`)
 * pour les proposer explicitement au Briefing ou dans une bannière dédiée,
 * SANS jamais les reporter silencieusement dans le Focus du jour courant.
 */
export function getUnfinishedPreviousFocusTasks(
  allFocusItems: readonly FocusItemRecord[],
  tasksById:
    | ReadonlyMap<string, TaskRecord>
    | Readonly<Record<string, TaskRecord>>
    | readonly TaskRecord[],
  currentFocusDay: string,
): UnfinishedPreviousFocusEntry[] {
  const currentDayTaskIds = new Set<string>(
    allFocusItems
      .filter(
        (item) =>
          item.deleted_at === null && item.focus_day === currentFocusDay,
      )
      .map((item) => item.task_id),
  );

  const previousCandidates = allFocusItems
    .filter(
      (item) =>
        item.deleted_at === null &&
        item.focus_day < currentFocusDay &&
        item.outcome !== 'completed' &&
        item.outcome !== 'abandoned',
    )
    .sort((a, b) => {
      if (a.focus_day !== b.focus_day) {
        return b.focus_day.localeCompare(a.focus_day);
      }
      return a.position - b.position;
    });

  const deduplicatedByTaskId = new Map<string, UnfinishedPreviousFocusEntry>();

  for (const focusItem of previousCandidates) {
    if (currentDayTaskIds.has(focusItem.task_id)) {
      continue;
    }
    if (deduplicatedByTaskId.has(focusItem.task_id)) {
      continue;
    }
    const task = resolveTaskById(tasksById, focusItem.task_id);
    if (
      !task ||
      task.deleted_at !== null ||
      task.status === 'done' ||
      task.status === 'cancelled'
    ) {
      continue;
    }

    deduplicatedByTaskId.set(focusItem.task_id, {
      focusItem: { ...focusItem },
      task: { ...task },
      previousFocusDay: focusItem.focus_day,
    });
  }

  return Array.from(deduplicatedByTaskId.values()).sort((a, b) => {
    if (a.previousFocusDay !== b.previousFocusDay) {
      return b.previousFocusDay.localeCompare(a.previousFocusDay);
    }
    if (b.task.priority !== a.task.priority) {
      return b.task.priority - a.task.priority;
    }
    return a.focusItem.position - b.focusItem.position;
  });
}

/**
 * FOC-4 : Crée un état de session pour le Mode « Maintenant » (isolation plein cadre d'une tâche du Focus).
 */
export function createNowModeSession(
  task: TaskRecord,
  defaultMinutes: number = DEFAULT_NOW_TIMER_MINUTES,
): NowModeSessionState {
  const safeDefaultMinutes =
    Number.isFinite(defaultMinutes) && defaultMinutes > 0
      ? Math.round(defaultMinutes)
      : DEFAULT_NOW_TIMER_MINUTES;

  const durationMinutes =
    typeof task.estimated_minutes === 'number' &&
    Number.isFinite(task.estimated_minutes) &&
    task.estimated_minutes > 0
      ? Math.round(task.estimated_minutes)
      : safeDefaultMinutes;

  const totalSeconds = durationMinutes * 60;

  return {
    taskId: task.id,
    title: task.title,
    notes: task.notes ?? '',
    durationMinutes,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: false,
    isFinished: false,
  };
}

/**
 * FOC-4 : Décrémente le minuteur du Mode « Maintenant » sans jamais descendre sous 0.
 */
export function tickNowModeTimer(
  remainingSeconds: number,
  elapsedSeconds = 1,
): { remainingSeconds: number; isFinished: boolean } {
  const safeRemaining =
    Number.isFinite(remainingSeconds) && remainingSeconds > 0
      ? Math.floor(remainingSeconds)
      : 0;
  const safeElapsed =
    Number.isFinite(elapsedSeconds) && elapsedSeconds > 0
      ? Math.floor(elapsedSeconds)
      : 0;

  const nextRemaining = Math.max(0, safeRemaining - safeElapsed);
  return {
    remainingSeconds: nextRemaining,
    isFinished: nextRemaining === 0,
  };
}

/**
 * FOC-4 : Formate un nombre de secondes en `MM:SS` (ou `HH:MM:SS` si >= 60 minutes).
 */
export function formatNowModeTimer(remainingSeconds: number): string {
  const safeTotal =
    Number.isFinite(remainingSeconds) && remainingSeconds > 0
      ? Math.floor(remainingSeconds)
      : 0;

  const hours = Math.floor(safeTotal / 3600);
  const minutes = Math.floor((safeTotal % 3600) / 60);
  const seconds = safeTotal % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
