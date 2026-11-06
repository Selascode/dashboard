import { describe, expect, it, vi } from 'vitest';
import {
  CommandHistory,
  CommandHistorySnapshot,
  UndoCommandKind,
} from '../command-history';

describe('CommandHistory (TSK-5 — Pile d’annulation Ctrl+Z / Cmd+Z)', () => {
  it('enregistre et annule une complétion de tâche (complete_task)', async () => {
    const history = new CommandHistory();
    let status: 'todo' | 'done' = 'done';

    const cmd = history.push({
      kind: 'complete_task',
      description: 'Réviser le chapitre de statistiques',
      undo: () => {
        status = 'todo';
      },
      redo: () => {
        status = 'done';
      },
    });

    expect(cmd.kind).toBe('complete_task');
    expect(history.canUndo()).toBe(true);
    expect(history.size()).toBe(1);
    expect(history.peek()?.description).toBe(
      'Réviser le chapitre de statistiques',
    );

    const undone = await history.undo();
    expect(undone?.id).toBe(cmd.id);
    expect(status).toBe('todo');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    const redone = await history.redo();
    expect(redone?.id).toBe(cmd.id);
    expect(status).toBe('done');
    expect(history.canUndo()).toBe(true);
  });

  it('enregistre et annule une suppression logique de tâche (delete_task)', async () => {
    const history = new CommandHistory();
    let deletedAt: string | null = null;

    await history.execute({
      kind: 'delete_task',
      description: 'Appeler le dentiste',
      do: () => {
        deletedAt = '2026-11-02T10:00:00Z';
      },
      undo: () => {
        deletedAt = null;
      },
    });

    expect(deletedAt).toBe('2026-11-02T10:00:00Z');
    expect(history.size()).toBe(1);

    await history.undo();
    expect(deletedAt).toBeNull();
  });

  it('gère les déplacements de catégorie/échéance (move_task) et les opérations Focus (reorder_focus, toggle_focus)', async () => {
    const history = new CommandHistory();
    let categoryId = 'cat-inbox';
    let focusOrder = ['t1', 't2', 't3'];
    let inFocus = false;

    const kinds: UndoCommandKind[] = [
      'move_task',
      'reorder_focus',
      'toggle_focus',
    ];
    expect(kinds).toHaveLength(3);

    await history.execute({
      kind: 'move_task',
      description: 'Déplacer vers École',
      do: () => {
        categoryId = 'cat-ecole';
      },
      undo: () => {
        categoryId = 'cat-inbox';
      },
    });

    await history.execute({
      kind: 'reorder_focus',
      description: 'Réordonner le Focus 5',
      do: () => {
        focusOrder = ['t3', 't1', 't2'];
      },
      undo: () => {
        focusOrder = ['t1', 't2', 't3'];
      },
    });

    await history.execute({
      kind: 'toggle_focus',
      description: 'Ajouter au Focus',
      do: () => {
        inFocus = true;
      },
      undo: () => {
        inFocus = false;
      },
    });

    expect(history.size()).toBe(3);
    expect(categoryId).toBe('cat-ecole');
    expect(focusOrder).toEqual(['t3', 't1', 't2']);
    expect(inFocus).toBe(true);

    // Annulation LIFO (dernier entré, premier annulé)
    const u1 = await history.undo();
    expect(u1?.kind).toBe('toggle_focus');
    expect(inFocus).toBe(false);

    const u2 = await history.undo();
    expect(u2?.kind).toBe('reorder_focus');
    expect(focusOrder).toEqual(['t1', 't2', 't3']);

    const u3 = await history.undo();
    expect(u3?.kind).toBe('move_task');
    expect(categoryId).toBe('cat-inbox');

    expect(await history.undo()).toBeNull();
  });

  it('respecte la limite maxSize et évince les commandes les plus anciennes', async () => {
    const history = new CommandHistory(3);
    const trace: number[] = [];

    for (let i = 1; i <= 5; i += 1) {
      history.push({
        id: `cmd-${i}`,
        kind: 'complete_task',
        description: `Tâche ${i}`,
        undo: () => {
          trace.push(i);
        },
      });
    }

    expect(history.size()).toBe(3);
    expect(history.peek()?.id).toBe('cmd-5');

    await history.undo();
    await history.undo();
    await history.undo();
    expect(trace).toEqual([5, 4, 3]);
    expect(history.canUndo()).toBe(false);
  });

  it('notifie les écouteurs via subscribe() et permet le désabonnement et clear()', async () => {
    const history = new CommandHistory();
    const snapshots: CommandHistorySnapshot[] = [];
    const listener = vi.fn((snap: CommandHistorySnapshot) => {
      snapshots.push(snap);
    });

    const unsubscribe = history.subscribe(listener);

    history.push({
      id: 'c1',
      kind: 'delete_task',
      description: 'Tâche test',
      undo: () => {},
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(snapshots[0].canUndo).toBe(true);
    expect(snapshots[0].lastCommand?.id).toBe('c1');

    history.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(history.size()).toBe(0);
    expect(history.canUndo()).toBe(false);

    unsubscribe();
    history.push({
      id: 'c2',
      kind: 'complete_task',
      description: 'Tâche après unsubscribe',
      undo: () => {},
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
