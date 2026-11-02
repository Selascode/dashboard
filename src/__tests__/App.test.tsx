import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { getSettingValue, resetMemoryFallbackStore } from '../lib/db';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('Coque, Navigation Clavier, Palette cmdk & Thèmes (Lots A & B)', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
  });

  it('affiche la barre latérale fixe, la topbar et les 4 zones du Dashboard au démarrage (DSH-1, DSH-3)', () => {
    render(<App />);

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('app-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();

    expect(screen.getByTestId('zone-focus5')).toBeInTheDocument();
    expect(screen.getByTestId('zone-today-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('zone-upcoming-deadlines')).toBeInTheDocument();
    expect(screen.getByTestId('zone-pinned-shortcuts')).toBeInTheDocument();

    expect(screen.getByTestId('compose-focus-btn')).toHaveTextContent('Composer mon Focus');
  });

  it('réserve un emplacement masqué pour le module Mail dans la barre latérale et le Dashboard (DSH-2)', () => {
    render(<App />);

    const sidebarMail = screen.getByTestId('sidebar-mail-reserved');
    const dashboardMail = screen.getByTestId('dashboard-mail-reserved');

    expect(sidebarMail).toBeInTheDocument();
    expect(sidebarMail).toHaveAttribute('hidden');
    expect(sidebarMail).toHaveAttribute('aria-hidden', 'true');

    expect(dashboardMail).toBeInTheDocument();
    expect(dashboardMail).toHaveAttribute('hidden');
    expect(dashboardMail).toHaveAttribute('aria-hidden', 'true');
  });

  it('gère les raccourcis Ctrl+1..4, Ctrl+B, Ctrl+K, Ctrl+N, N, ? et Échap (ACC-1)', async () => {
    render(<App />);

    // Ctrl+2 -> Tâches
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tasks')).toHaveAttribute('aria-current', 'page');

    // Touche N dans la vue Tâches -> focus sur le champ d'ajout
    const quickInput = screen.getByTestId('tasks-quick-add-input');
    quickInput.blur();
    fireEvent.keyDown(window, { key: 'n' });
    expect(document.activeElement).toBe(quickInput);

    // Ctrl+3 -> Agenda (écran bientôt)
    fireEvent.keyDown(window, { key: '3', ctrlKey: true });
    expect(await screen.findByTestId('page-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agenda')).toHaveAttribute('aria-current', 'page');

    // Ctrl+4 -> Paramètres (écran bientôt + apparence)
    fireEvent.keyDown(window, { key: '4', ctrlKey: true });
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();
    expect(screen.getByTestId('settings-coming-soon')).toBeInTheDocument();

    // Ctrl+B -> Briefing (écran bientôt) puis Échap ferme le Briefing (BRF-3)
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(await screen.findByTestId('page-briefing')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();

    // Ctrl+K -> Palette cmdk puis Échap ferme la palette
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByTestId('command-palette-overlay')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('command-palette-overlay')).not.toBeInTheDocument();
    });

    // ? -> Aide des raccourcis puis Échap ferme la modale
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(await screen.findByTestId('shortcuts-help-modal')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('shortcuts-help-modal')).not.toBeInTheDocument();
    });

    // Ctrl+N -> Nouvelle tâche (ouvre Tâches et focus l'input)
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();
  });

  it('bascule le thème Clair / Sombre / Système depuis les Paramètres et persiste dans Setting (ACC-2)', async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-settings'));
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('theme-option-dark'));
    await waitFor(async () => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(await getSettingValue('theme', 'system')).toBe('dark');
    });

    fireEvent.click(screen.getByTestId('theme-option-light'));
    await waitFor(async () => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(await getSettingValue('theme', 'system')).toBe('light');
    });

    fireEvent.click(screen.getByTestId('theme-option-system'));
    await waitFor(async () => {
      expect(await getSettingValue('theme', 'light')).toBe('system');
    });
  });
});
