import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { useTranslations } from '../../i18n';
import { COMMAND_REGISTRY } from '../../lib/commands';

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  open,
  onClose,
}) => {
  const t = useTranslations();

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="shortcuts-help-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/75 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-subtle bg-surface p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-primary">
              <Keyboard className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-lg font-display font-bold text-primary"
              >
                {t.commands.shortcutsModalTitle}
              </h2>
              <p className="text-xs text-secondary">
                {t.commands.shortcutsModalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="shortcuts-modal-close"
            onClick={onClose}
            aria-label={t.app.close}
            className="rounded-full p-2 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="divide-y divide-subtle">
          {COMMAND_REGISTRY.map((cmd) => {
            const label = t.commands[cmd.labelKey] as string;
            return (
              <li
                key={cmd.id}
                data-testid={`shortcut-help-row-${cmd.id}`}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-primary">{label}</span>
                <kbd className="rounded-md bg-surface-muted px-2.5 py-1 text-xs font-mono font-semibold text-secondary">
                  {cmd.shortcutBadge}
                </kbd>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
