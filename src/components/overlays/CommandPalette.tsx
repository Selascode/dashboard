import React, { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslations } from '../../i18n';
import { COMMAND_REGISTRY, CommandId } from '../../lib/commands';
import { TaskRecord } from '../../lib/db';
import { formatDateByPreference } from '../../lib/quick-parser';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecuteCommand: (commandId: CommandId) => void;
  tasks?: TaskRecord[];
  onSelectTask?: (taskId: string) => void;
  onSelectTemplate?: (templateText: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onExecuteCommand,
  tasks = [],
  onSelectTask,
  onSelectTemplate,
}) => {
  const t = useTranslations();
  const { dateFormat } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  if (!open) {
    return null;
  }

  const navCommands = COMMAND_REGISTRY.filter((c) => c.group === 'navigation');
  const actionCommands = COMMAND_REGISTRY.filter(
    (c) => c.group === 'actions' && c.id !== 'app.palette' && c.id !== 'app.escape',
  );

  const templates = [
    t.tasks.syntaxPanel.templates.study,
    t.tasks.syntaxPanel.templates.sport,
    t.tasks.syntaxPanel.templates.project,
  ];

  return (
    <div
      data-testid="command-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t.commands.paletteTitle}
      className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/75 backdrop-blur-sm pt-20 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-3xl border border-subtle bg-surface shadow-lg overflow-hidden">
        <Command label={t.commands.paletteTitle} className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-subtle px-5 py-3.5">
            <Search className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <Command.Input
              ref={inputRef}
              data-testid="command-palette-input"
              placeholder={t.commands.palettePlaceholder}
              className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-mono text-secondary hover:text-primary"
            >
              {t.nav.shortcuts.escape}
            </button>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-3 space-y-3">
            <Command.Empty className="py-6 text-center text-sm text-secondary">
              {t.commands.emptyResults}
            </Command.Empty>

            <Command.Group
              heading={t.commands.groupNavigation}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2 space-y-1"
            >
              {navCommands.map((cmd) => {
                const label = t.commands[cmd.labelKey] as string;
                return (
                  <Command.Item
                    key={cmd.id}
                    value={`${label} ${cmd.shortcutBadge}`}
                    data-testid={`palette-item-${cmd.id}`}
                    onSelect={() => {
                      onExecuteCommand(cmd.id);
                      onClose();
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-primary aria-selected:bg-surface-muted hover:bg-surface-muted"
                  >
                    <span>{label}</span>
                    <kbd className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-secondary">
                      {cmd.shortcutBadge}
                    </kbd>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading={t.commands.groupActions}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2 space-y-1"
            >
              {actionCommands.map((cmd) => {
                const label = t.commands[cmd.labelKey] as string;
                return (
                  <Command.Item
                    key={cmd.id}
                    value={`${label} ${cmd.shortcutBadge}`}
                    data-testid={`palette-item-${cmd.id}`}
                    onSelect={() => {
                      onExecuteCommand(cmd.id);
                      onClose();
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-primary aria-selected:bg-surface-muted hover:bg-surface-muted"
                  >
                    <span>{label}</span>
                    <kbd className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-secondary">
                      {cmd.shortcutBadge}
                    </kbd>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {onSelectTemplate && (
              <Command.Group
                heading={t.commands.groupTemplates}
                className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2 space-y-1"
              >
                {templates.map((tpl) => (
                  <Command.Item
                    key={tpl.label}
                    value={`${tpl.label} ${tpl.template}`}
                    onSelect={() => {
                      onSelectTemplate(tpl.template);
                      onClose();
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-primary aria-selected:bg-surface-muted hover:bg-surface-muted"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                      <span>{tpl.label}</span>
                    </span>
                    <span className="text-xs font-mono text-secondary">
                      {tpl.template}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {tasks.length > 0 && onSelectTask && (
              <Command.Group
                heading={t.commands.groupTasks}
                className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2 space-y-1"
              >
                {tasks.slice(0, 8).map((task) => (
                  <Command.Item
                    key={task.id}
                    value={`${task.title} ${task.notes}`}
                    onSelect={() => {
                      onSelectTask(task.id);
                      onClose();
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-primary aria-selected:bg-surface-muted hover:bg-surface-muted"
                  >
                    <span>{task.title}</span>
                    {task.due_date && (
                      <span className="text-xs text-secondary">
                        {formatDateByPreference(task.due_date, dateFormat)}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
