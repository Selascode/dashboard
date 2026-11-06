import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import {
  TaskRecord,
  addFocusItem,
  createTask,
  getSettingValue,
  listFocusItems,
  resetMemoryFallbackStore,
  seedDemoData,
} from '../lib/db';

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

  it('affiche les tâches démo dans le Dashboard et Tâches, filtre par catégorie, édite le détail et annule avec Ctrl+Z (LOT C : FOC-1..4, TSK-1..7, CAP-2, CMD-3)', async () => {
    seedDemoData();
    render(<App />);

    // Le Dashboard affiche "Bonjour Selasi, votre journée, l’esprit léger." et la liste Focus 5 active
    expect(await screen.findByTestId('dashboard-greeting-heading')).toHaveTextContent(
      'Bonjour Selasi, votre journée, l’esprit léger.',
    );
    expect(await screen.findByTestId('focus5-task-list')).toBeInTheDocument();

    // Navigation vers l'écran Tâches
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    // Panneau de droite par défaut = rappel de syntaxe rapide et modèles (pas d'import d'image)
    expect(screen.getByTestId('task-syntax-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('task-detail-panel')).not.toBeInTheDocument();

    // Filtre par catégorie École
    fireEvent.click(screen.getByTestId('category-card-ecole'));
    expect(screen.getByTestId('task-row-demo-task-1')).toBeInTheDocument();
    expect(screen.queryByTestId('task-row-demo-task-3')).not.toBeInTheDocument();

    // Retour sur Toutes les catégories
    fireEvent.click(screen.getByTestId('category-card-all'));
    expect(screen.getByTestId('task-row-demo-task-3')).toBeInTheDocument();

    // Bascule Vue Catégories (TSK-6) puis retour Vue Liste
    fireEvent.click(screen.getByTestId('tasks-view-categories'));
    expect(screen.getByTestId('tasks-categories-grid')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tasks-view-list'));

    // Saisie rapide avec aperçu en direct (#ecole @auj !3 ~45m *)
    const quickInput = screen.getByTestId('tasks-quick-add-input');
    fireEvent.change(quickInput, {
      target: { value: 'Préparer oral architecture #ecole @auj !3 ~45m *' },
    });
    expect(screen.getByTestId('quick-syntax-live-preview')).toBeInTheDocument();
    fireEvent.submit(quickInput.closest('form')!);

    // La tâche créée est sélectionnée et ouvre le panneau de détail à droite
    expect(await screen.findByTestId('task-detail-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detail-title-input')).toHaveValue(
      'Préparer oral architecture',
    );

    // Fermeture du panneau de détail -> retour au panneau de syntaxe
    fireEvent.click(screen.getByTestId('task-detail-close-btn'));
    expect(await screen.findByTestId('task-syntax-panel')).toBeInTheDocument();

    // Complétion d'une tâche puis annulation via Ctrl+Z (TSK-5)
    fireEvent.click(screen.getByTestId('task-checkbox-demo-task-1'));
    expect(await screen.findByTestId('undo-toast')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() => {
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });
  });

  it('gère les raccourcis Ctrl+1..4 sur clavier AZERTY (Digit1..Digit4 avec &, é, ", \') et pavé numérique (Numpad1..Numpad4)', async () => {
    render(<App />);

    // AZERTY Ctrl+& (Digit2 -> Tâches)
    fireEvent.keyDown(window, { key: 'é', code: 'Digit2', ctrlKey: true });
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    // AZERTY Ctrl+" (Digit3 -> Agenda)
    fireEvent.keyDown(window, { key: '"', code: 'Digit3', ctrlKey: true });
    expect(await screen.findByTestId('page-agenda')).toBeInTheDocument();

    // AZERTY Ctrl+' (Digit4 -> Paramètres)
    fireEvent.keyDown(window, { key: "'", code: 'Digit4', ctrlKey: true });
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();

    // AZERTY Ctrl+& (Digit1 -> Dashboard)
    fireEvent.keyDown(window, { key: '&', code: 'Digit1', ctrlKey: true });
    expect(await screen.findByTestId('page-dashboard')).toBeInTheDocument();

    // Pavé numérique Ctrl+Numpad2 -> Tâches
    fireEvent.keyDown(window, { key: '2', code: 'Numpad2', ctrlKey: true });
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    // Pavé numérique Ctrl+Numpad4 -> Paramètres
    fireEvent.keyDown(window, { key: '4', code: 'Numpad4', ctrlKey: true });
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();
  });

  it('permet de replier/déplier le panneau droit de la page Tâches (Option B), persiste dans settings et le rouvre à la sélection d’une tâche', async () => {
    await seedDemoData();
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    // Par défaut le panneau est ouvert
    expect(screen.getByTestId('tasks-right-panel')).toHaveAttribute(
      'data-collapsed',
      'false',
    );
    expect(screen.getByTestId('task-syntax-panel')).toBeInTheDocument();

    // Clic sur le bouton pour replier le panneau
    fireEvent.click(screen.getByTestId('tasks-panel-collapse-btn'));
    await waitFor(async () => {
      expect(screen.getByTestId('tasks-right-panel')).toHaveAttribute(
        'data-collapsed',
        'true',
      );
      expect(
        screen.getByTestId('tasks-right-panel-collapsed-strip'),
      ).toBeInTheDocument();
      expect(
        await getSettingValue('quick_capture_panel_collapsed', false),
      ).toBe(true);
    });

    // Sélectionner une tâche dans la liste rouvre automatiquement le panneau (quick_capture_panel_collapsed = false)
    fireEvent.click(screen.getByTestId('task-select-demo-task-1'));
    await waitFor(async () => {
      expect(screen.getByTestId('tasks-right-panel')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
      expect(screen.getByTestId('task-detail-panel')).toBeInTheDocument();
      expect(
        await getSettingValue('quick_capture_panel_collapsed', true),
      ).toBe(false);
    });

    // Replier à nouveau depuis le panneau de détail puis rouvrir via le bouton du bandeau vertical
    fireEvent.click(screen.getByTestId('tasks-panel-collapse-btn'));
    const collapsedStrip = await screen.findByTestId(
      'tasks-right-panel-collapsed-strip',
    );
    expect(collapsedStrip).toBeInTheDocument();

    const collapsedLabel = screen.getByTestId('tasks-right-panel-collapsed-label');
    expect(collapsedLabel.className).toContain('whitespace-nowrap');
    expect(collapsedLabel.className).toContain('[writing-mode:horizontal-tb]');
    expect(collapsedLabel.className).toContain('lg:[writing-mode:vertical-rl]');
    expect(collapsedLabel.getAttribute('style')).toBeNull();

    fireEvent.click(screen.getByTestId('tasks-panel-expand-btn'));
    await waitFor(async () => {
      expect(screen.getByTestId('tasks-right-panel')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
      expect(
        await getSettingValue('quick_capture_panel_collapsed', true),
      ).toBe(false);
    });

    // Replier puis cliquer sur la barre pliée entière (ou son libellé) pour la déplier au doigt/souris
    fireEvent.click(screen.getByTestId('tasks-panel-collapse-btn'));
    expect(
      await screen.findByTestId('tasks-right-panel-collapsed-strip'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tasks-right-panel-collapsed-label'));
    await waitFor(async () => {
      expect(screen.getByTestId('tasks-right-panel')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
    });
  });

  it('tronque les tâches longues avec line-clamp-1 et permet d’étendre/replier via Voir plus / Voir moins', async () => {
    const longTask = await createTask({
      title:
        'Rédiger le mémoire complet d’architecture logicielle distribuée avec analyse comparative détaillée',
      notes:
        'Inclure les schémas de séquence, les benchmarks SQLite local-first et la revue de littérature académique',
      category_id: 'cat-ecole',
      due_date: '2026-11-02',
    });

    render(<App />);
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();

    const titleEl = await screen.findByTestId(`task-title-${longTask.id}`);
    expect(titleEl.className).toContain('line-clamp-1');

    const expandBtn = screen.getByTestId(`task-expand-btn-${longTask.id}`);
    expect(expandBtn).toHaveTextContent('Voir plus');
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveTextContent('Voir moins');
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    expect(titleEl.className).not.toContain('line-clamp-1');

    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveTextContent('Voir plus');
    expect(titleEl.className).toContain('line-clamp-1');
  });

  it('permet de changer le format de date dans les Paramètres (DD-MM-YYYY, YYYY-MM-DD, MM-DD-YYYY) et met à jour l’affichage et la saisie rapide', async () => {
    await seedDemoData();
    render(<App />);

    // Vérifier le format par défaut DD-MM-YYYY dans Tâches (demo-task-5 est au 2026-11-04 -> 04-11-2026)
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();
    expect(await screen.findByTestId('task-due-label-demo-task-5')).toHaveTextContent(
      '04-11-2026',
    );

    // Aller dans Paramètres et choisir MM-DD-YYYY
    fireEvent.click(screen.getByTestId('nav-settings'));
    expect(await screen.findByTestId('page-settings')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('date-format-option-MM-DD-YYYY'));
    await waitFor(async () => {
      expect(await getSettingValue('date_format', 'DD-MM-YYYY')).toBe(
        'MM-DD-YYYY',
      );
    });

    // Retour dans Tâches : l'échéance est formatée en MM-DD-YYYY (11-04-2026) et la saisie rapide interprète @11-15-2026
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('task-due-label-demo-task-5')).toHaveTextContent(
      '11-04-2026',
    );
    expect(screen.getByTestId('syntax-token-date-desc')).toHaveTextContent(
      '@11-15-2026',
    );

    const quickInput = screen.getByTestId('tasks-quick-add-input');
    fireEvent.change(quickInput, {
      target: { value: 'Livrer version beta @11-15-2026' },
    });
    expect(screen.getByTestId('quick-preview-due-badge')).toHaveTextContent(
      '@11-15-2026',
    );
  });

  it('valide les nouveautés J2 : refus de la 6e tâche Focus sur Dashboard/Tâches, bannière FOC-3, Mode Maintenant (FOC-4), réordonnancement annulable Ctrl+Z (TSK-5) et section Sauvegardes / Export JSON (BKP-1..3)', async () => {
    const yesterday = '2026-11-01';
    const today = '2026-11-02';

    const pastTask = await createTask({
      title: 'Tâche non terminée de la veille',
      priority: 3,
      due_date: yesterday,
    });
    await addFocusItem(yesterday, pastTask.id);

    const todayTasks: TaskRecord[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const tk = await createTask({
        title: `Priorité Jour ${i}`,
        priority: 3,
        due_date: today,
        estimated_minutes: 40,
      });
      todayTasks.push(tk);
      if (i <= 5) {
        await addFocusItem(today, tk.id);
      }
    }

    render(<App />);

    // 1. Bannière de rétention FOC-3 présente sur le Dashboard
    expect(
      await screen.findByTestId('unfinished-yesterday-focus-banner'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`unfinished-past-focus-item-${pastTask.id}`),
    ).toHaveTextContent('Tâche non terminée de la veille');

    // 2. Tentative de reprendre la tâche de la veille alors que 5 tâches sont déjà au Focus -> refus FOC-1
    fireEvent.click(screen.getByTestId(`resume-past-focus-btn-${pastTask.id}`));
    expect(
      await screen.findByTestId('dashboard-focus-limit-alert'),
    ).toHaveTextContent(/5 priorités maximum/i);

    // 3. Réordonnancement dans Focus 5 + annulation via Ctrl+Z (CommandHistory)
    const moveDownBtn = screen.getByTestId(
      `focus-move-down-${todayTasks[0].id}`,
    );
    fireEvent.click(moveDownBtn);
    await waitFor(async () => {
      const items = await listFocusItems(today);
      expect(items[0].task_id).toBe(todayTasks[1].id);
    });
    expect(await screen.findByTestId('undo-toast')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(async () => {
      const items = await listFocusItems(today);
      expect(items[0].task_id).toBe(todayTasks[0].id);
    });

    // 4. Mode Maintenant (FOC-4) initialisé sur la durée estimée (40:00) et bouton Terminer la tâche
    fireEvent.click(screen.getByTestId('focus-now-mode-trigger'));
    expect(await screen.findByTestId('focus-now-mode')).toBeInTheDocument();
    expect(screen.getByTestId('now-mode-timer-display')).toHaveTextContent(
      '40:00',
    );
    fireEvent.click(screen.getByTestId('now-mode-complete-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('focus-now-mode')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('focus5-progress')).toHaveTextContent('1/5');

    // 5. Refus de la 6e tâche Focus depuis la page Tâches
    fireEvent.click(screen.getByTestId('nav-tasks'));
    expect(await screen.findByTestId('page-tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`task-select-${todayTasks[5].id}`));
    fireEvent.click(await screen.findByTestId('detail-toggle-focus-btn'));
    expect(await screen.findByTestId('focus-limit-alert')).toHaveTextContent(
      /5 priorités maximum/i,
    );

    // 6. Section Sauvegardes & Export JSON dans Paramètres (BKP-1, BKP-2, BKP-3)
    fireEvent.click(screen.getByTestId('nav-settings'));
    expect(
      await screen.findByTestId('settings-backup-section'),
    ).toBeInTheDocument();

    const dirInput = screen.getByTestId('settings-backup-dir-input');
    fireEvent.change(dirInput, { target: { value: '/tmp/mes-backups-focus' } });
    fireEvent.click(screen.getByTestId('settings-backup-dir-save'));
    await waitFor(async () => {
      expect(await getSettingValue('backup_dir', '')).toBe(
        '/tmp/mes-backups-focus',
      );
    });

    fireEvent.click(screen.getByTestId('settings-trigger-backup-btn'));
    expect(
      await screen.findByTestId('settings-backups-list'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-export-json-btn'));
    const exportPreview = await screen.findByTestId(
      'settings-export-json-preview',
    );
    expect(exportPreview).toHaveTextContent('productivity-dashboard-backup-v1');
  });
});
