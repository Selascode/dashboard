import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { getSettingValue, resetMemoryFallbackStore } from '../lib/db';

describe('Jalon J0 — Socle UI, Navigation Clavier, Layout Fixe & Thèmes', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
  });

  it('affiche la barre latérale fixe et les 4 zones du Dashboard au démarrage (DSH-1, DSH-3)', () => {
    render(<App />);

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();

    // 4 zones fixes du Dashboard
    expect(screen.getByTestId('zone-focus5')).toBeInTheDocument();
    expect(screen.getByTestId('zone-today-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('zone-upcoming-deadlines')).toBeInTheDocument();
    expect(screen.getByTestId('zone-pinned-shortcuts')).toBeInTheDocument();

    // État vide utile du Focus 5 avec bouton "Composer mon Focus"
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

  it('permet de naviguer entre les écrans au clic et via les raccourcis clavier Ctrl+1, Ctrl+2, Ctrl+3 (ACC-1)', async () => {
    render(<App />);

    // Ctrl+2 -> Tâches
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tasks')).toHaveAttribute('aria-current', 'page');

    // Vérifie les 5 catégories par défaut chargées depuis la couche d'accès aux données
    await waitFor(() => {
      expect(screen.getByTestId('category-card-inbox')).toBeInTheDocument();
      expect(screen.getByTestId('category-card-ecole')).toBeInTheDocument();
      expect(screen.getByTestId('category-card-sport')).toBeInTheDocument();
      expect(screen.getByTestId('category-card-perso')).toBeInTheDocument();
      expect(screen.getByTestId('category-card-projets')).toBeInTheDocument();
    });

    // Ctrl+3 -> Agenda
    fireEvent.keyDown(window, { key: '3', ctrlKey: true });
    expect(await screen.findByTestId('page-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('nav-agenda')).toHaveAttribute('aria-current', 'page');

    // Ctrl+1 -> Retour au Dashboard
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
  });

  it('bascule le thème Clair / Sombre / Système depuis les Paramètres et persiste dans Setting (ACC-2)', async () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-settings'));
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();

    // Bascule en thème Sombre
    fireEvent.click(screen.getByTestId('theme-option-dark'));
    await waitFor(async () => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(await getSettingValue('theme', 'system')).toBe('dark');
    });

    // Bascule en thème Clair
    fireEvent.click(screen.getByTestId('theme-option-light'));
    await waitFor(async () => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(await getSettingValue('theme', 'system')).toBe('light');
    });

    // Bascule en thème Système
    fireEvent.click(screen.getByTestId('theme-option-system'));
    await waitFor(async () => {
      expect(await getSettingValue('theme', 'light')).toBe('system');
    });
  });
});
