import { describe, expect, it } from 'vitest';
import { FocusItemRecord, TaskRecord } from '../db';
import {
  DEFAULT_NOW_TIMER_MINUTES,
  MAX_FOCUS_ITEMS,
  canAddTaskToFocus,
  computeFocusProgress,
  computeReorderedFocusPositions,
  createNowModeSession,
  formatNowModeTimer,
  getUnfinishedPreviousFocusTasks,
  moveFocusItemInList,
  tickNowModeTimer,
} from '../focus-engine';

function makeTask(overrides: Partial<TaskRecord> & { id: string }): TaskRecord {
  const now = '2026-11-02T08:00:00Z';
  return {
    id: overrides.id,
    title: overrides.title ?? `Tâche ${overrides.id}`,
    notes: overrides.notes ?? '',
    category_id: overrides.category_id ?? 'cat-inbox',
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 2,
    due_date: overrides.due_date ?? '2026-11-02',
    has_due_time: overrides.has_due_time ?? false,
    estimated_minutes:
      overrides.estimated_minutes !== undefined
        ? overrides.estimated_minutes
        : null,
    completed_at: overrides.completed_at ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'test-device',
  };
}

function makeFocusItem(
  overrides: Partial<FocusItemRecord> & {
    id: string;
    task_id: string;
    position: number;
  },
): FocusItemRecord {
  const now = '2026-11-02T08:00:00Z';
  return {
    id: overrides.id,
    focus_day: overrides.focus_day ?? '2026-11-02',
    task_id: overrides.task_id,
    position: overrides.position,
    outcome: overrides.outcome ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    device_id: overrides.device_id ?? 'test-device',
  };
}

describe('Focus 5 Engine (FOC-1 à FOC-4)', () => {
  describe('FOC-1 : Validation de sélection (canAddTaskToFocus)', () => {
    it('autorise l’ajout d’une tâche active lorsque le Focus contient moins de 5 éléments', () => {
      const existing = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1 }),
        makeFocusItem({ id: 'f2', task_id: 't2', position: 2 }),
      ];
      const candidate = makeTask({ id: 't3', status: 'todo' });

      const res = canAddTaskToFocus(existing, candidate, '2026-11-02');
      expect(res).toEqual({ allowed: true });
    });

    it('refuse strictement un 6e ajout avec le message métier explicite', () => {
      const fiveItems = [1, 2, 3, 4, 5].map((i) =>
        makeFocusItem({ id: `f${i}`, task_id: `t${i}`, position: i }),
      );
      const sixthTask = makeTask({ id: 't6', status: 'todo' });

      const res = canAddTaskToFocus(fiveItems, sixthTask, '2026-11-02');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('limit_reached');
      expect(res.messageFr).toBe(
        'Limite atteinte : Le Focus du jour ne peut pas contenir plus de 5 tâches.',
      );
      expect(MAX_FOCUS_ITEMS).toBe(5);
    });

    it('ignore les éléments supprimés logiquement ou appartenant à un autre jour lors du contrôle de la limite des 5', () => {
      const items = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1 }),
        makeFocusItem({ id: 'f2', task_id: 't2', position: 2 }),
        makeFocusItem({ id: 'f3', task_id: 't3', position: 3 }),
        makeFocusItem({ id: 'f4', task_id: 't4', position: 4 }),
        makeFocusItem({
          id: 'f5-deleted',
          task_id: 't5',
          position: 5,
          deleted_at: '2026-11-02T09:00:00Z',
        }),
        makeFocusItem({
          id: 'f6-yesterday',
          task_id: 't6',
          position: 1,
          focus_day: '2026-11-01',
        }),
      ];
      const newTask = makeTask({ id: 't7', status: 'in_progress' });

      const res = canAddTaskToFocus(items, newTask, '2026-11-02');
      expect(res.allowed).toBe(true);
    });

    it('refuse les doublons pour le même jour', () => {
      const existing = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1 }),
      ];
      const duplicate = makeTask({ id: 't1', status: 'todo' });

      const res = canAddTaskToFocus(existing, duplicate, '2026-11-02');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('already_in_focus');
      expect(res.messageFr).toContain('déjà dans le Focus');
    });

    it('refuse une tâche supprimée ou absente', () => {
      const deletedTask = makeTask({
        id: 't-del',
        deleted_at: '2026-11-02T08:30:00Z',
      });

      const resDeleted = canAddTaskToFocus([], deletedTask, '2026-11-02');
      expect(resDeleted.allowed).toBe(false);
      expect(resDeleted.reason).toBe('task_deleted');

      const resNull = canAddTaskToFocus([], null, '2026-11-02');
      expect(resNull.allowed).toBe(false);
      expect(resNull.reason).toBe('task_deleted');
    });

    it('refuse une tâche déjà terminée ou annulée', () => {
      const doneTask = makeTask({ id: 't-done', status: 'done' });
      const cancelledTask = makeTask({ id: 't-cancel', status: 'cancelled' });

      expect(canAddTaskToFocus([], doneTask, '2026-11-02')).toMatchObject({
        allowed: false,
        reason: 'task_completed',
      });
      expect(canAddTaskToFocus([], cancelledTask, '2026-11-02')).toMatchObject({
        allowed: false,
        reason: 'task_completed',
      });
    });
  });

  describe('FOC-1 : Réordonnancement des positions 1 à 5', () => {
    it('moveFocusItemInList déplace un identifiant de fromIndex à toIndex sans muter le tableau original', () => {
      const initial = ['t1', 't2', 't3', 't4'];
      const movedDown = moveFocusItemInList(initial, 0, 2);

      expect(movedDown).toEqual(['t2', 't3', 't1', 't4']);
      expect(initial).toEqual(['t1', 't2', 't3', 't4']);

      const movedUp = moveFocusItemInList(movedDown, 3, 1);
      expect(movedUp).toEqual(['t2', 't4', 't3', 't1']);
    });

    it('moveFocusItemInList gère les indices hors bornes ou identiques sans erreur', () => {
      const initial = ['t1', 't2', 't3'];
      expect(moveFocusItemInList(initial, -1, 1)).toEqual(['t1', 't2', 't3']);
      expect(moveFocusItemInList(initial, 0, 99)).toEqual(['t1', 't2', 't3']);
      expect(moveFocusItemInList(initial, 1, 1)).toEqual(['t1', 't2', 't3']);
    });

    it('computeReorderedFocusPositions garantit des positions continues 1..N (plafonnées à 5)', () => {
      const items = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1 }),
        makeFocusItem({ id: 'f2', task_id: 't2', position: 2 }),
        makeFocusItem({ id: 'f3', task_id: 't3', position: 3 }),
      ];

      const reordered = computeReorderedFocusPositions(
        items,
        ['t3', 't1', 't2'],
        '2026-11-02T10:00:00Z',
      );

      expect(reordered.map((r) => ({ id: r.task_id, pos: r.position }))).toEqual(
        [
          { id: 't3', pos: 1 },
          { id: 't1', pos: 2 },
          { id: 't2', pos: 3 },
        ],
      );
      expect(reordered[0].updated_at).toBe('2026-11-02T10:00:00Z');
    });

    it('computeReorderedFocusPositions conserve à la fin les éléments actifs omis dans orderedTaskIds et plafonne à 5', () => {
      const items = [1, 2, 3, 4, 5, 6].map((i) =>
        makeFocusItem({ id: `f${i}`, task_id: `t${i}`, position: i }),
      );

      const reordered = computeReorderedFocusPositions(items, ['t4', 't2']);
      expect(reordered).toHaveLength(5);
      expect(reordered.map((r) => r.task_id)).toEqual([
        't4',
        't2',
        't1',
        't3',
        't5',
      ]);
      expect(reordered.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('FOC-2 : Validation / Complétion et Ratio de progression immédiat (computeFocusProgress)', () => {
    it('calcule immédiatement le ratio "3/5" et les 5 segments quand 3 tâches sur 5 sont terminées', () => {
      const tasks = new Map<string, TaskRecord>([
        ['t1', makeTask({ id: 't1', status: 'done' })],
        ['t2', makeTask({ id: 't2', status: 'todo' })],
        ['t3', makeTask({ id: 't3', status: 'done' })],
        ['t4', makeTask({ id: 't4', status: 'todo' })],
        ['t5', makeTask({ id: 't5', status: 'todo' })],
      ]);

      const focusItems = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1, outcome: 'completed' }),
        makeFocusItem({ id: 'f2', task_id: 't2', position: 2, outcome: null }),
        makeFocusItem({ id: 'f3', task_id: 't3', position: 3, outcome: null }),
        makeFocusItem({ id: 'f4', task_id: 't4', position: 4, outcome: 'completed' }),
        makeFocusItem({ id: 'f5', task_id: 't5', position: 5, outcome: null }),
      ];

      const progress = computeFocusProgress(focusItems, tasks);
      expect(progress.completedCount).toBe(3);
      expect(progress.totalCount).toBe(5);
      expect(progress.maxSlots).toBe(5);
      expect(progress.ratioLabel).toBe('3/5');
      expect(progress.completionPercent).toBe(60);
      expect(progress.segments).toEqual([
        { index: 1, state: 'completed', taskId: 't1' },
        { index: 2, state: 'pending', taskId: 't2' },
        { index: 3, state: 'completed', taskId: 't3' },
        { index: 4, state: 'completed', taskId: 't4' },
        { index: 5, state: 'pending', taskId: 't5' },
      ]);
    });

    it('remplit les emplacements restants avec state = "empty" lorsque moins de 5 tâches sont sélectionnées', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'done' }),
        makeTask({ id: 't2', status: 'todo' }),
      ];
      const focusItems = [
        makeFocusItem({ id: 'f1', task_id: 't1', position: 1 }),
        makeFocusItem({ id: 'f2', task_id: 't2', position: 2 }),
      ];

      const progress = computeFocusProgress(focusItems, tasks);
      expect(progress.completedCount).toBe(1);
      expect(progress.totalCount).toBe(2);
      expect(progress.ratioLabel).toBe('1/5');
      expect(progress.completionPercent).toBe(20);
      expect(progress.segments).toEqual([
        { index: 1, state: 'completed', taskId: 't1' },
        { index: 2, state: 'pending', taskId: 't2' },
        { index: 3, state: 'empty', taskId: null },
        { index: 4, state: 'empty', taskId: null },
        { index: 5, state: 'empty', taskId: null },
      ]);
    });
  });

  describe('FOC-3 : Rétention des tâches non terminées de la veille sans report silencieux', () => {
    it('identifie uniquement les tâches actives non terminées des jours précédents qui ne sont pas dans le Focus du jour', () => {
      const tasksById: Record<string, TaskRecord> = {
        't-prev-unfinished': makeTask({
          id: 't-prev-unfinished',
          title: 'TP SGBD non fini',
          status: 'todo',
          priority: 3,
        }),
        't-prev-completed': makeTask({
          id: 't-prev-completed',
          title: 'Tâche finie hier',
          status: 'done',
          priority: 2,
        }),
        't-prev-abandoned': makeTask({
          id: 't-prev-abandoned',
          title: 'Tâche abandonnée hier',
          status: 'todo',
          priority: 1,
        }),
        't-already-today': makeTask({
          id: 't-already-today',
          title: 'Déjà reprise aujourd’hui',
          status: 'todo',
          priority: 3,
        }),
        't-older-unfinished': makeTask({
          id: 't-older-unfinished',
          title: 'Tâche d’avant-hier',
          status: 'in_progress',
          priority: 2,
        }),
      };

      const allFocusItems: FocusItemRecord[] = [
        makeFocusItem({
          id: 'f-y1',
          focus_day: '2026-11-01',
          task_id: 't-prev-unfinished',
          position: 1,
          outcome: null,
        }),
        makeFocusItem({
          id: 'f-y2',
          focus_day: '2026-11-01',
          task_id: 't-prev-completed',
          position: 2,
          outcome: 'completed',
        }),
        makeFocusItem({
          id: 'f-y3',
          focus_day: '2026-11-01',
          task_id: 't-prev-abandoned',
          position: 3,
          outcome: 'abandoned',
        }),
        makeFocusItem({
          id: 'f-y4',
          focus_day: '2026-11-01',
          task_id: 't-already-today',
          position: 4,
          outcome: 'carried_over',
        }),
        makeFocusItem({
          id: 'f-old',
          focus_day: '2026-10-31',
          task_id: 't-older-unfinished',
          position: 1,
          outcome: null,
        }),
        // Focus du jour courant (2026-11-02)
        makeFocusItem({
          id: 'f-today-1',
          focus_day: '2026-11-02',
          task_id: 't-already-today',
          position: 1,
          outcome: null,
        }),
      ];

      const unfinished = getUnfinishedPreviousFocusTasks(
        allFocusItems,
        tasksById,
        '2026-11-02',
      );

      expect(unfinished.map((u) => u.task.id)).toEqual([
        't-prev-unfinished',
        't-older-unfinished',
      ]);
      expect(unfinished[0].previousFocusDay).toBe('2026-11-01');
      expect(unfinished[1].previousFocusDay).toBe('2026-10-31');
      // Vérifie qu'aucun élément n'a été injecté silencieusement dans allFocusItems pour 2026-11-02
      const todayCount = allFocusItems.filter(
        (f) => f.focus_day === '2026-11-02',
      ).length;
      expect(todayCount).toBe(1);
    });

    it('déduplique une tâche présente sur plusieurs jours passés en conservant l’occurrence la plus récente', () => {
      const task = makeTask({ id: 't-repeat', status: 'todo', priority: 2 });
      const allFocusItems = [
        makeFocusItem({
          id: 'f-old',
          focus_day: '2026-10-30',
          task_id: 't-repeat',
          position: 2,
        }),
        makeFocusItem({
          id: 'f-recent',
          focus_day: '2026-11-01',
          task_id: 't-repeat',
          position: 1,
        }),
      ];

      const res = getUnfinishedPreviousFocusTasks(
        allFocusItems,
        [task],
        '2026-11-02',
      );
      expect(res).toHaveLength(1);
      expect(res[0].previousFocusDay).toBe('2026-11-01');
      expect(res[0].focusItem.id).toBe('f-recent');
    });
  });

  describe('FOC-4 : Mode « Maintenant » (createNowModeSession, tickNowModeTimer, formatNowModeTimer)', () => {
    it('initialise une session avec la durée estimée de la tâche si présente, sinon 25 min par défaut', () => {
      const taskWithEstimate = makeTask({
        id: 't-est',
        title: 'Réviser les stats',
        notes: 'Chapitre 4',
        estimated_minutes: 45,
      });
      const sessionEst = createNowModeSession(taskWithEstimate);
      expect(sessionEst.durationMinutes).toBe(45);
      expect(sessionEst.totalSeconds).toBe(45 * 60);
      expect(sessionEst.remainingSeconds).toBe(45 * 60);
      expect(sessionEst.isRunning).toBe(false);
      expect(sessionEst.isFinished).toBe(false);

      const taskWithoutEstimate = makeTask({
        id: 't-no-est',
        estimated_minutes: null,
      });
      const sessionDefault = createNowModeSession(taskWithoutEstimate);
      expect(sessionDefault.durationMinutes).toBe(DEFAULT_NOW_TIMER_MINUTES);
      expect(sessionDefault.remainingSeconds).toBe(25 * 60);
    });

    it('décrémente le minuteur et signale isFinished à 0 sans descendre en négatif', () => {
      expect(tickNowModeTimer(10, 1)).toEqual({
        remainingSeconds: 9,
        isFinished: false,
      });
      expect(tickNowModeTimer(1, 1)).toEqual({
        remainingSeconds: 0,
        isFinished: true,
      });
      expect(tickNowModeTimer(0, 5)).toEqual({
        remainingSeconds: 0,
        isFinished: true,
      });
    });

    it('formate le temps restant en MM:SS ou HH:MM:SS si >= 60 minutes', () => {
      expect(formatNowModeTimer(25 * 60)).toBe('25:00');
      expect(formatNowModeTimer(65)).toBe('01:05');
      expect(formatNowModeTimer(0)).toBe('00:00');
      expect(formatNowModeTimer(3661)).toBe('01:01:01');
      expect(formatNowModeTimer(120 * 60)).toBe('02:00:00');
    });
  });
});
