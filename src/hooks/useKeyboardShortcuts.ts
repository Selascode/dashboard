import { useEffect } from 'react';
import {
  AppScreenId,
  CommandId,
  resolveCommandFromKeyboardEvent,
} from '../lib/commands';

export interface UseKeyboardShortcutsOptions {
  activeScreen: AppScreenId;
  onExecuteCommand: (commandId: CommandId) => void;
}

/**
 * Hook centralisé de gestion des raccourcis clavier globaux de l'application (ACC-1, CMD-1).
 * Prend en charge Ctrl/Meta+1..4 via `e.code` (Digit1..Digit4 et Numpad1..Numpad4)
 * pour la compatibilité AZERTY (&, é, ", ') et pavé numérique.
 */
export function useKeyboardShortcuts({
  activeScreen,
  onExecuteCommand,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const cmdId = resolveCommandFromKeyboardEvent(event);
      if (!cmdId) {
        return;
      }
      if (cmdId === 'tasks.inline_add' && activeScreen !== 'tasks') {
        return;
      }
      event.preventDefault();
      onExecuteCommand(cmdId);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeScreen, onExecuteCommand]);
}
