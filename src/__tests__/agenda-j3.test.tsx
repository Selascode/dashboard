import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  KEYCHAIN_ICS_URL_PREFIX,
  createCalendarSource,
  createTask,
  getBrowserKeychainSecret,
  listCalendarEvents,
  listCalendarSources,
  recordCalendarSourceError,
  resetMemoryFallbackStore,
  saveCalendarEventsForSource,
} from '../lib/db';
import { parseIcsFeed } from '../lib/calendar-engine';

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

const SAMPLE_ICS_CONTENT = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Focus//Agenda Test//FR',
  'BEGIN:VEVENT',
  'UID:evt-cours-algo@focus.local',
  'SUMMARY:Cours Algorithmique Avancée',
  'DTSTART:20261102T090000',
  'DTEND:20261102T103000',
  'LOCATION:Amphi Turing B2',
  'DESCRIPTION:Révision arbres équilibrés et graphes',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-workshop-ux@focus.local',
  'SUMMARY:Atelier Design System',
  'DTSTART:20261104T140000',
  'DTEND:20261104T160000',
  'LOCATION:Salle 104',
  'DESCRIPTION:Revue de contraste WCAG AA',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-daily-standup@focus.local',
  'SUMMARY:Point Equipe Quotidien',
  'DTSTART:20261102T110000',
  'DTEND:20261102T111500',
  'RRULE:FREQ=DAILY;COUNT=3',
  'LOCATION:Visio Salle A',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('Jalon J3 — Widget Agenda Dashboard At-a-Glance, Écran Agenda (Ctrl+3) & Sources ICS dans Paramètres (Ctrl+4)', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('affiche la mini-grille sur le Dashboard, bascule Mois/Semaine, affiche les points et ouvre le popover At-a-Glance après 150ms de survol OU au focus clavier', async () => {
    const src = await createCalendarSource({
      name: 'Emploi du temps Master',
      source_type: 'file',
      location: 'edt-master.ics',
      raw_ics_content: SAMPLE_ICS_CONTENT,
    });
    const parsed = parseIcsFeed(SAMPLE_ICS_CONTENT);
    await saveCalendarEventsForSource(src.id, parsed);

    render(<App />);

    expect(await screen.findByTestId('zone-today-agenda')).toBeInTheDocument();

    // Attendre que les points d'événements apparaissent sous le 2026-11-02 et 2026-11-04
    expect(
      await screen.findByTestId('dashboard-agenda-dot-2026-11-02'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-agenda-dot-2026-11-04'),
    ).toBeInTheDocument();

    // Le récapitulatif du jour actif par défaut (2026-11-02) affiche le cours d'Algorithmique
    const summaryBox = screen.getByTestId('dashboard-agenda-day-summary');
    expect(summaryBox).toHaveTextContent('Cours Algorithmique Avancée');
    expect(summaryBox).toHaveTextContent('Amphi Turing B2');

    // Bascule Semaine -> Mois -> Semaine
    fireEvent.click(screen.getByTestId('dashboard-agenda-view-month'));
    expect(screen.getByTestId('dashboard-agenda-view-month')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByTestId('dashboard-agenda-day-2026-11-25'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-agenda-view-week'));
    expect(screen.getByTestId('dashboard-agenda-view-week')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Test de l'infobulle At-a-Glance après 150ms de survol souris
    vi.useFakeTimers();
    const day04Btn = screen.getByTestId('dashboard-agenda-day-2026-11-04');

    fireEvent.mouseEnter(day04Btn);
    // Avant 150ms : pas encore affiché
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(
      screen.queryByTestId('dashboard-agenda-popover'),
    ).not.toBeInTheDocument();

    // À 150ms : le popover apparaît avec l'horaire, le titre et le lieu
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const popover = screen.getByTestId('dashboard-agenda-popover');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent('Atelier Design System');
    expect(popover).toHaveTextContent('14:00 – 16:00');
    expect(popover).toHaveTextContent('Salle 104');

    // Quitter le survol ferme le popover
    fireEvent.mouseLeave(day04Btn);
    expect(
      screen.queryByTestId('dashboard-agenda-popover'),
    ).not.toBeInTheDocument();

    vi.useRealTimers();

    // Focus clavier sur une date avec événement -> ouvre immédiatement le popover
    fireEvent.focus(day04Btn);
    expect(screen.getByTestId('dashboard-agenda-popover')).toHaveTextContent(
      'Atelier Design System',
    );

    // Touche Échap ferme le popover
    fireEvent.keyDown(day04Btn, { key: 'Escape' });
    expect(
      screen.queryByTestId('dashboard-agenda-popover'),
    ).not.toBeInTheDocument();

    // Clic sur le 2026-11-04 met à jour le récapitulatif inférieur
    fireEvent.click(day04Btn);
    expect(screen.getByTestId('dashboard-agenda-day-summary')).toHaveTextContent(
      'Atelier Design System',
    );

    // Clic sur une journée vide (2026-11-06) affiche l'état vide "Une journée sans rendez-vous."
    fireEvent.click(screen.getByTestId('dashboard-agenda-day-2026-11-06'));
    expect(screen.getByTestId('dashboard-agenda-day-summary')).toHaveTextContent(
      'Une journée sans rendez-vous.',
    );
  });

  it("affiche l'écran Agenda complet (Ctrl+3), bascule Semaine/Mois (AGD-2), superpose les échéances de tâches (AGD-6) et ouvre le panneau de détail en lecture seule (AGD-3)", async () => {
    const src = await createCalendarSource({
      name: 'Calendrier Universitaire',
      source_type: 'file',
      location: 'univ.ics',
      raw_ics_content: SAMPLE_ICS_CONTENT,
    });
    await saveCalendarEventsForSource(src.id, parseIcsFeed(SAMPLE_ICS_CONTENT));

    const deadlineTask = await createTask({
      title: 'Rendre le rapport de sécurité',
      notes: 'Format PDF signé avec annexes',
      category_id: 'cat-ecole',
      due_date: '2026-11-02',
      priority: 3,
    });

    render(<App />);

    // Navigation vers Agenda via Ctrl+3
    fireEvent.keyDown(window, { key: '3', ctrlKey: true });
    expect(await screen.findByTestId('page-agenda')).toBeInTheDocument();
    expect(screen.getByTestId('agenda-grid-week')).toBeInTheDocument();

    // Vérifier que l'événement ICS et l'échéance de tâche sont tous deux affichés et visuellement distingués (AGD-6)
    const dayCell02 = await screen.findByTestId('agenda-day-cell-2026-11-02');
    expect(dayCell02).toHaveTextContent('Cours Algorithmique Avancée');
    expect(dayCell02).toHaveTextContent('Rendre le rapport de sécurité');
    expect(
      screen.getByTestId(`agenda-deadline-badge-${deadlineTask.id}`),
    ).toHaveTextContent('Échéance');

    // Vérifier que la récurrence RRULE (COUNT=3 : 02, 03, 04 nov) est bien dépliée (AGD-4)
    expect(screen.getByTestId('agenda-day-cell-2026-11-03')).toHaveTextContent(
      'Point Equipe Quotidien',
    );

    // Clic sur l'événement ICS -> ouvre le panneau de détail en lecture seule à droite (AGD-3)
    const algoBtn = screen
      .getAllByRole('button')
      .find((el) => el.textContent?.includes('Cours Algorithmique Avancée'));
    expect(algoBtn).toBeDefined();
    fireEvent.click(algoBtn!);

    const detailPanel = screen.getByTestId('agenda-event-detail-panel');
    expect(detailPanel).toBeInTheDocument();
    expect(screen.getByTestId('agenda-detail-title')).toHaveTextContent(
      'Cours Algorithmique Avancée',
    );
    expect(screen.getByTestId('agenda-detail-location')).toHaveTextContent(
      'Amphi Turing B2',
    );
    expect(screen.getByTestId('agenda-detail-notes')).toHaveTextContent(
      'Révision arbres équilibrés et graphes',
    );
    expect(screen.getByTestId('agenda-detail-source')).toHaveTextContent(
      'Calendrier Universitaire',
    );
    expect(
      screen.getByTestId('agenda-detail-readonly-badge'),
    ).toHaveTextContent('Lecture seule (ICS)');

    // Bascule vers la vue Mois en un clic (AGD-2)
    fireEvent.click(screen.getByTestId('agenda-view-month'));
    expect(screen.getByTestId('agenda-grid-month')).toBeInTheDocument();
    expect(
      screen.getByTestId('agenda-day-cell-2026-11-20'),
    ).toBeInTheDocument();
  });

  it("permet d'ajouter une source ICS fichier ou URL (PRV-3), de l'actualiser, d'afficher l'alerte de cache hors-ligne (AGD-5) et de la supprimer dans Paramètres (Ctrl+4, AGD-1)", async () => {
    render(<App />);

    // Aller dans Paramètres (Ctrl+4)
    fireEvent.keyDown(window, { key: '4', ctrlKey: true });
    expect(
      await screen.findByTestId('settings-calendar-sources-section'),
    ).toBeInTheDocument();

    // 1. Ajout d'une source Fichier local (.ics) avec upload de fichier
    fireEvent.change(screen.getByTestId('settings-ics-name-input'), {
      target: { value: 'Mon Agenda Local' },
    });

    const fileInput = screen.getByTestId(
      'settings-ics-file-input',
    ) as HTMLInputElement;
    const fakeFile = new File([SAMPLE_ICS_CONTENT], 'mon-agenda.ics', {
      type: 'text/calendar',
    });
    Object.defineProperty(fakeFile, 'text', {
      value: () => Promise.resolve(SAMPLE_ICS_CONTENT),
    });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('settings-ics-location-input')).toHaveValue(
        'mon-agenda.ics',
      );
    });

    fireEvent.click(screen.getByTestId('settings-add-ics-source-btn'));

    await waitFor(async () => {
      const sources = await listCalendarSources();
      expect(sources.length).toBe(1);
      expect(sources[0].name).toBe('Mon Agenda Local');
      const events = await listCalendarEvents(sources[0].id);
      expect(events.length).toBe(3);
    });

    // 2. Ajout d'une source URL ICS stockée dans le trousseau sécurisé (PRV-3)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SAMPLE_ICS_CONTENT,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fireEvent.click(screen.getByTestId('settings-ics-type-url'));
    expect(
      screen.getByTestId('settings-ics-keychain-notice'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('settings-ics-name-input'), {
      target: { value: 'Calendrier Distant Secret' },
    });
    fireEvent.change(screen.getByTestId('settings-ics-location-input'), {
      target: { value: 'https://secret.example.org/private/token-xyz.ics' },
    });
    fireEvent.change(screen.getByTestId('settings-ics-interval-input'), {
      target: { value: '15' },
    });

    fireEvent.click(screen.getByTestId('settings-add-ics-source-btn'));

    let urlSourceId = '';
    await waitFor(async () => {
      const sources = await listCalendarSources();
      expect(sources.length).toBe(2);
      const urlSrc = sources.find(
        (s) => s.name === 'Calendrier Distant Secret',
      );
      expect(urlSrc).toBeDefined();
      urlSourceId = urlSrc!.id;
      // PRV-3 : la colonne SQLite contient uniquement la référence de trousseau et jamais l'URL en clair
      expect(urlSrc!.location_or_keychain_ref).toBe(
        `${KEYCHAIN_ICS_URL_PREFIX}${urlSrc!.id}`,
      );
      expect(getBrowserKeychainSecret(urlSrc!.location_or_keychain_ref)).toBe(
        'https://secret.example.org/private/token-xyz.ics',
      );
    });

    // 3. Simuler une erreur de synchronisation sur cette source (AGD-5) et vérifier l'affichage du badge hors-ligne
    await recordCalendarSourceError(urlSourceId, ' Serveur ICS injoignable (503) ');
    // Déclencher un rafraîchissement qui échoue pour vérifier l'UI
    fetchMock.mockRejectedValueOnce(new Error('Hors-ligne temporaire'));
    fireEvent.click(
      screen.getByTestId(`settings-sync-source-btn-${urlSourceId}`),
    );

    const errorAlert = await screen.findByTestId(
      `settings-source-error-${urlSourceId}`,
    );
    expect(errorAlert).toHaveTextContent('Hors-ligne temporaire');
    expect(errorAlert).toHaveTextContent(/consultables hors-ligne/i);

    // Les événements déjà en cache restent intacts (AGD-5)
    const cachedEvents = await listCalendarEvents(urlSourceId);
    expect(cachedEvents.length).toBe(3);

    // 4. Suppression de la source URL
    fireEvent.click(
      screen.getByTestId(`settings-delete-source-btn-${urlSourceId}`),
    );
    await waitFor(async () => {
      const remaining = await listCalendarSources();
      expect(remaining.length).toBe(1);
    });
  });
});
