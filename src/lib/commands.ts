import { TranslationDictionary } from '../i18n';

export type AppScreenId =
  | 'dashboard'
  | 'tasks'
  | 'agenda'
  | 'settings'
  | 'briefing';

export type CommandId =
  | 'nav.dashboard'
  | 'nav.tasks'
  | 'nav.agenda'
  | 'nav.settings'
  | 'nav.briefing'
  | 'app.palette'
  | 'tasks.new'
  | 'tasks.inline_add'
  | 'app.undo'
  | 'app.shortcuts_help'
  | 'app.escape';

export interface CommandDefinition {
  id: CommandId;
  group: 'navigation' | 'actions';
  /** Clé dans t.commands */
  labelKey: keyof TranslationDictionary['commands'];
  /** Clé dans t.nav si cet item apparaît dans la barre latérale */
  sidebarLabelKey?: 'dashboard' | 'tasks' | 'agenda' | 'settings';
  /** Écran cible pour la navigation */
  targetScreen?: AppScreenId;
  /** Raccourci affiché dans les badges (ex: CTRL+1) */
  shortcutBadge: string;
  /** Raccourci canonique pour la détection clavier */
  defaultShortcut: {
    key: string;
    ctrlOrMeta?: boolean;
    shift?: boolean;
    ignoreWhenTyping?: boolean;
  };
}

/**
 * Registre unique de commandes (Section 1 de .agents/agents/ui-keyboard-dev.md).
 * Alimente la barre latérale, la topbar, la palette cmdk, l'aide des raccourcis (?) et le routeur clavier.
 */
export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  {
    id: 'nav.dashboard',
    group: 'navigation',
    labelKey: 'navDashboard',
    sidebarLabelKey: 'dashboard',
    targetScreen: 'dashboard',
    shortcutBadge: 'CTRL+1',
    defaultShortcut: {
      key: '1',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'nav.tasks',
    group: 'navigation',
    labelKey: 'navTasks',
    sidebarLabelKey: 'tasks',
    targetScreen: 'tasks',
    shortcutBadge: 'CTRL+2',
    defaultShortcut: {
      key: '2',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'nav.agenda',
    group: 'navigation',
    labelKey: 'navAgenda',
    sidebarLabelKey: 'agenda',
    targetScreen: 'agenda',
    shortcutBadge: 'CTRL+3',
    defaultShortcut: {
      key: '3',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'nav.settings',
    group: 'navigation',
    labelKey: 'navSettings',
    sidebarLabelKey: 'settings',
    targetScreen: 'settings',
    shortcutBadge: 'CTRL+4',
    defaultShortcut: {
      key: '4',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'nav.briefing',
    group: 'navigation',
    labelKey: 'openBriefing',
    targetScreen: 'briefing',
    shortcutBadge: 'CTRL+B',
    defaultShortcut: {
      key: 'b',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'app.palette',
    group: 'actions',
    labelKey: 'paletteTitle',
    shortcutBadge: 'CTRL+K',
    defaultShortcut: {
      key: 'k',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'tasks.new',
    group: 'actions',
    labelKey: 'createNewTask',
    shortcutBadge: 'CTRL+N',
    defaultShortcut: {
      key: 'n',
      ctrlOrMeta: true,
    },
  },
  {
    id: 'tasks.inline_add',
    group: 'actions',
    labelKey: 'inlineNewTask',
    shortcutBadge: 'N',
    defaultShortcut: {
      key: 'n',
      ctrlOrMeta: false,
      ignoreWhenTyping: true,
    },
  },
  {
    id: 'app.undo',
    group: 'actions',
    labelKey: 'undoLastAction',
    shortcutBadge: 'CTRL+Z',
    defaultShortcut: {
      key: 'z',
      ctrlOrMeta: true,
      ignoreWhenTyping: true,
    },
  },
  {
    id: 'app.shortcuts_help',
    group: 'actions',
    labelKey: 'openShortcutsHelp',
    shortcutBadge: '?',
    defaultShortcut: {
      key: '?',
      ctrlOrMeta: false,
      ignoreWhenTyping: true,
    },
  },
  {
    id: 'app.escape',
    group: 'actions',
    labelKey: 'closeOverlay',
    shortcutBadge: 'ÉCHAP',
    defaultShortcut: {
      key: 'Escape',
      ctrlOrMeta: false,
    },
  },
] as const;

export function getCommandById(id: CommandId): CommandDefinition {
  const found = COMMAND_REGISTRY.find((cmd) => cmd.id === id);
  if (!found) {
    throw new Error(`Commande introuvable dans le registre : ${id}`);
  }
  return found;
}

export function getSidebarCommands(): CommandDefinition[] {
  return COMMAND_REGISTRY.filter((cmd) => Boolean(cmd.sidebarLabelKey));
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return target.isContentEditable;
}

/**
 * Résout un code physique (Digit1..Digit4 ou Numpad1..Numpad4) vers le chiffre '1'..'4'.
 * Permet aux claviers AZERTY (où les touches 1..4 sans Shift produisent &, é, ", ')
 * ainsi qu'au pavé numérique de déclencher immédiatement Ctrl+1..4 (ACC-1, CMD-1).
 */
function resolveDigitKeyFromCode(code?: string): string | null {
  switch (code) {
    case 'Digit1':
    case 'Numpad1':
      return '1';
    case 'Digit2':
    case 'Numpad2':
      return '2';
    case 'Digit3':
    case 'Numpad3':
      return '3';
    case 'Digit4':
    case 'Numpad4':
      return '4';
    default:
      return null;
  }
}

/**
 * Résout une touche clavier vers l'identifiant de commande du registre unique.
 */
export function resolveCommandFromKeyboardEvent(
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target'
  > & {
    code?: string;
  },
): CommandId | null {
  if (event.altKey) {
    return null;
  }

  const typing = isEditableElement(event.target);
  const hasModifier = Boolean(event.ctrlKey || event.metaKey);
  const digitFromCode = hasModifier ? resolveDigitKeyFromCode(event.code) : null;
  const normalizedKey =
    event.key === 'Escape'
      ? 'Escape'
      : digitFromCode ?? event.key.toLowerCase();

  for (const cmd of COMMAND_REGISTRY) {
    const { key, ctrlOrMeta, ignoreWhenTyping } = cmd.defaultShortcut;
    if (ignoreWhenTyping && typing) {
      continue;
    }

    if (key === 'Escape') {
      if (event.key === 'Escape' && !hasModifier) {
        return cmd.id;
      }
      continue;
    }

    if (key === '?') {
      if (event.key === '?' && !hasModifier) {
        return cmd.id;
      }
      continue;
    }

    if (Boolean(ctrlOrMeta) !== hasModifier) {
      continue;
    }

    if (ctrlOrMeta && event.shiftKey && !digitFromCode) {
      continue;
    }

    if (!ctrlOrMeta && event.shiftKey && key !== '?') {
      continue;
    }

    if (normalizedKey === key.toLowerCase()) {
      return cmd.id;
    }
  }

  return null;
}
