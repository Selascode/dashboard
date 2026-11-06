export type UndoCommandKind =
  | 'complete_task'
  | 'delete_task'
  | 'move_task'
  | 'reorder_focus'
  | 'toggle_focus';

export interface UndoableCommand {
  id: string;
  kind: UndoCommandKind;
  description: string;
  createdAt: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
}

export interface ExecutableUndoableCommand {
  id?: string;
  kind: UndoCommandKind;
  description: string;
  createdAt?: string;
  do?: () => Promise<void> | void;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
}

export interface PushUndoableCommandInput {
  id?: string;
  kind?: UndoCommandKind;
  description: string;
  createdAt?: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
}

export interface CommandHistorySnapshot {
  canUndo: boolean;
  canRedo: boolean;
  size: number;
  redoSize: number;
  lastCommand: UndoableCommand | null;
}

export type CommandHistoryListener = (snapshot: CommandHistorySnapshot) => void;

export const DEFAULT_COMMAND_HISTORY_MAX_SIZE = 50;

let commandSeqCounter = 1;

function nextCommandId(): string {
  commandSeqCounter += 1;
  return `cmd-${Date.now()}-${commandSeqCounter}`;
}

/**
 * TSK-5 : Gestionnaire d'historique réversible pur et générique (`CommandHistory`)
 * pour prendre en charge `Ctrl+Z` / `Cmd+Z` sur :
 * - la complétion / dé-complétion d'une tâche (`complete_task`),
 * - la suppression logique d'une tâche (`delete_task`),
 * - le déplacement / changement de catégorie, d'échéance ou le réordonnancement Focus (`move_task` / `reorder_focus` / `toggle_focus`).
 */
export class CommandHistory {
  private readonly maxSize: number;
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private listeners: Set<CommandHistoryListener> = new Set();

  constructor(maxSize: number = DEFAULT_COMMAND_HISTORY_MAX_SIZE) {
    this.maxSize =
      Number.isFinite(maxSize) && maxSize >= 1
        ? Math.floor(maxSize)
        : DEFAULT_COMMAND_HISTORY_MAX_SIZE;
  }

  /**
   * Empile une commande annulable déjà exécutée et vide la pile `redo`.
   */
  public push(input: PushUndoableCommandInput): UndoableCommand {
    const command: UndoableCommand = {
      id: input.id?.trim() ? input.id.trim() : nextCommandId(),
      kind: input.kind ?? 'move_task',
      description: input.description,
      createdAt: input.createdAt ?? new Date().toISOString(),
      undo: input.undo,
      redo: input.redo,
    };

    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.splice(0, this.undoStack.length - this.maxSize);
    }
    this.redoStack = [];
    this.notifyListeners();
    return command;
  }

  /**
   * Exécute l'action `do()` (ou `redo()` si fourni) puis enregistre la commande dans la pile `undo`.
   */
  public async execute(
    input: ExecutableUndoableCommand,
  ): Promise<UndoableCommand> {
    const actionToRun = input.do ?? input.redo;
    if (actionToRun) {
      await actionToRun();
    }

    return this.push({
      id: input.id,
      kind: input.kind,
      description: input.description,
      createdAt: input.createdAt,
      undo: input.undo,
      redo: input.redo ?? input.do,
    });
  }

  /**
   * Dépile la dernière commande, exécute sa fonction `undo()` et retourne la commande annulée.
   * Si la commande possède un `redo`, elle est placée dans la pile `redo`.
   */
  public async undo(): Promise<UndoableCommand | null> {
    if (this.undoStack.length === 0) {
      return null;
    }

    const command = this.undoStack.pop()!;
    await command.undo();

    if (command.redo) {
      this.redoStack.push(command);
      if (this.redoStack.length > this.maxSize) {
        this.redoStack.splice(0, this.redoStack.length - this.maxSize);
      }
    }

    this.notifyListeners();
    return command;
  }

  /**
   * Ré-exécute la dernière commande annulée si elle dispose d'un `redo()`.
   */
  public async redo(): Promise<UndoableCommand | null> {
    if (this.redoStack.length === 0) {
      return null;
    }

    const command = this.redoStack.pop()!;
    if (command.redo) {
      await command.redo();
    }

    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.splice(0, this.undoStack.length - this.maxSize);
    }

    this.notifyListeners();
    return command;
  }

  /**
   * Retourne la commande au sommet de la pile `undo` sans la dépiler.
   */
  public peek(): UndoableCommand | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    return this.undoStack[this.undoStack.length - 1];
  }

  /**
   * Indique si au moins une commande peut être annulée.
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Indique si au moins une commande peut être rétablie (`redo`).
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Nombre de commandes actuellement dans la pile `undo`.
   */
  public size(): number {
    return this.undoStack.length;
  }

  /**
   * Vide intégralement les piles `undo` et `redo`.
   */
  public clear(): void {
    if (this.undoStack.length === 0 && this.redoStack.length === 0) {
      return;
    }
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Retourne un instantané immuable de l'état courant.
   */
  public getSnapshot(): CommandHistorySnapshot {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      size: this.undoStack.length,
      redoSize: this.redoStack.length,
      lastCommand: this.peek(),
    };
  }

  /**
   * Abonne un écouteur aux changements de la pile d'historique (pour l'UI/toast React).
   * Retourne une fonction de désabonnement.
   */
  public subscribe(listener: CommandHistoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
