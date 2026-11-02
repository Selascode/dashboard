import { describe, expect, it } from 'vitest';
import {
  COMMAND_REGISTRY,
  getCommandById,
  getSidebarCommands,
  resolveCommandFromKeyboardEvent,
} from '../commands';

describe('Registre unique de commandes (src/lib/commands.ts)', () => {
  it('expose les 4 entrées de navigation latérale et l’ensemble des raccourcis requis', () => {
    const sidebar = getSidebarCommands();
    expect(sidebar.map((c) => c.id)).toEqual([
      'nav.dashboard',
      'nav.tasks',
      'nav.agenda',
      'nav.settings',
    ]);
    expect(sidebar.map((c) => c.shortcutBadge)).toEqual([
      'CTRL+1',
      'CTRL+2',
      'CTRL+3',
      'CTRL+4',
    ]);
    expect(getCommandById('app.palette').shortcutBadge).toBe('CTRL+K');
    expect(getCommandById('nav.briefing').shortcutBadge).toBe('CTRL+B');
    expect(getCommandById('tasks.new').shortcutBadge).toBe('CTRL+N');
    expect(getCommandById('tasks.inline_add').shortcutBadge).toBe('N');
    expect(getCommandById('app.undo').shortcutBadge).toBe('CTRL+Z');
    expect(getCommandById('app.shortcuts_help').shortcutBadge).toBe('?');
    expect(getCommandById('app.escape').shortcutBadge).toBe('ÉCHAP');
    expect(COMMAND_REGISTRY.length).toBeGreaterThanOrEqual(11);
  });

  it('résout correctement les événements clavier vers les identifiants de commandes', () => {
    expect(
      resolveCommandFromKeyboardEvent({
        key: '1',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('nav.dashboard');

    expect(
      resolveCommandFromKeyboardEvent({
        key: '4',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('nav.settings');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('app.palette');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'b',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('nav.briefing');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'n',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('tasks.new');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'n',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('tasks.inline_add');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'z',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('app.undo');

    expect(
      resolveCommandFromKeyboardEvent({
        key: '?',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        target: null,
      }),
    ).toBe('app.shortcuts_help');

    expect(
      resolveCommandFromKeyboardEvent({
        key: 'Escape',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
      }),
    ).toBe('app.escape');
  });

  it('ignore les raccourcis à touche simple (N, ?) lorsque le focus est dans un champ de saisie', () => {
    const input = document.createElement('input');
    expect(
      resolveCommandFromKeyboardEvent({
        key: 'n',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: input,
      }),
    ).toBeNull();

    expect(
      resolveCommandFromKeyboardEvent({
        key: '?',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        target: input,
      }),
    ).toBeNull();
  });
});
