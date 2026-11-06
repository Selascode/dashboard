import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CalendarEventRecord,
  TaskRecord,
  createCalendarSource,
  listCalendarEvents,
  listCalendarSources,
  resetMemoryFallbackStore,
  updateCalendarSource,
} from '../db';
import {
  expandCalendarEventsForRange,
  getAgendaForDay,
  getDaysWithAgendaItems,
  isCalendarSourceDueForSync,
  mergeEventsAndTaskDeadlines,
  parseIcsFeed,
  syncAllCalendarSources,
  syncCalendarSourceById,
} from '../calendar-engine';

const SAMPLE_UNIVERSITY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Universite//EmploiDuTemps//FR
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:cours-sgbd-2026@univ.fr
SUMMARY:CM Systèmes de Gestion de Bases de Données
DESCRIPTION:Chapitre 4 : Indexation B-Tree et transactions ACID\\nApporter son ordinateur
LOCATION:Amphi Turing - Bâtiment B
DTSTART;TZID=Europe/Paris:20261102T090000
DTEND;TZID=Europe/Paris:20261102T110000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6
EXDATE;TZID=Europe/Paris:20261111T090000
END:VEVENT
BEGIN:VEVENT
UID:soutenance-projet-2026@univ.fr
SUMMARY:Soutenance intermédiaire
DESCRIPTION:Présentation de 15 minutes
LOCATION:Salle B204
DTSTART:20261105T140000Z
DTEND:20261105T153000Z
END:VEVENT
END:VCALENDAR`;

function makeEventRecord(
  partial: Partial<CalendarEventRecord> & {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
  },
): CalendarEventRecord {
  return {
    id: partial.id,
    source_id: partial.source_id ?? 'src-test',
    ics_uid: partial.ics_uid ?? `uid-${partial.id}`,
    title: partial.title,
    start_at: partial.start_at,
    end_at: partial.end_at,
    is_all_day: partial.is_all_day ?? false,
    location: partial.location ?? '',
    notes: partial.notes ?? '',
    rrule: partial.rrule ?? null,
    exdates_json: partial.exdates_json ?? '[]',
  };
}

function makeTaskRecord(
  partial: Partial<TaskRecord> & { id: string; title: string },
): TaskRecord {
  return {
    id: partial.id,
    title: partial.title,
    notes: partial.notes ?? '',
    category_id: partial.category_id ?? 'cat-ecole',
    status: partial.status ?? 'todo',
    priority: partial.priority ?? 2,
    due_date: partial.due_date ?? null,
    has_due_time: partial.has_due_time ?? false,
    estimated_minutes: partial.estimated_minutes ?? null,
    completed_at: partial.completed_at ?? null,
    created_at: partial.created_at ?? '2026-11-01T08:00:00Z',
    updated_at: partial.updated_at ?? '2026-11-01T08:00:00Z',
    deleted_at: partial.deleted_at ?? null,
    device_id: partial.device_id ?? 'test-device',
  };
}

describe('Moteur d’Agenda ICS, Récurrences RRULE & Superposition des Échéances (AGD-4, AGD-5, AGD-6)', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Parsing ICS (parseIcsFeed — AGD-4)
  // ==========================================================================

  it('1. parse un flux ICS universitaire réel avec SUMMARY, LOCATION, DESCRIPTION, TZID=Europe/Paris et UTC', () => {
    const parsed = parseIcsFeed(SAMPLE_UNIVERSITY_ICS);
    expect(parsed).toHaveLength(2);

    const sgbd = parsed.find((e) => e.ics_uid === 'cours-sgbd-2026@univ.fr');
    expect(sgbd).toBeDefined();
    expect(sgbd?.title).toBe('CM Systèmes de Gestion de Bases de Données');
    expect(sgbd?.location).toBe('Amphi Turing - Bâtiment B');
    expect(sgbd?.notes).toContain('Chapitre 4 : Indexation B-Tree');
    expect(sgbd?.notes).toContain('Apporter son ordinateur');
    expect(sgbd?.is_all_day).toBe(false);
    // Le 2 novembre 2026 est en heure d'hiver (CET = UTC+1) : 09:00 Europe/Paris -> 08:00 UTC
    expect(sgbd?.start_at).toBe('2026-11-02T08:00:00.000Z');
    expect(sgbd?.end_at).toBe('2026-11-02T10:00:00.000Z');
    expect(sgbd?.rrule).toContain('FREQ=WEEKLY');
    expect(sgbd?.rrule).toContain('BYDAY=MO,WE');
    expect(sgbd?.rrule).toContain('COUNT=6');

    const exdates = JSON.parse(sgbd?.exdates_json ?? '[]') as string[];
    expect(exdates).toContain('2026-11-11T08:00:00.000Z');

    const soutenance = parsed.find(
      (e) => e.ics_uid === 'soutenance-projet-2026@univ.fr',
    );
    expect(soutenance).toBeDefined();
    expect(soutenance?.title).toBe('Soutenance intermédiaire');
    expect(soutenance?.location).toBe('Salle B204');
    expect(soutenance?.start_at).toBe('2026-11-05T14:00:00.000Z');
    expect(soutenance?.end_at).toBe('2026-11-05T15:30:00.000Z');
    expect(soutenance?.rrule).toBeNull();
  });

  it("2. convertit correctement le fuseau Europe/Paris en heure d'été (CEST = UTC+2) et heure d'hiver (CET = UTC+1)", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
BEGIN:VEVENT
UID:summer-event@test
SUMMARY:Cours été
DTSTART;TZID=Europe/Paris:20260715T100000
DTEND;TZID=Europe/Paris:20260715T120000
END:VEVENT
BEGIN:VEVENT
UID:winter-event@test
SUMMARY:Cours hiver
DTSTART;TZID=Europe/Paris:20261215T100000
DTEND;TZID=Europe/Paris:20261215T120000
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsFeed(ics);
    const summer = events.find((e) => e.ics_uid === 'summer-event@test');
    const winter = events.find((e) => e.ics_uid === 'winter-event@test');

    // En juillet (UTC+2), 10h00 Paris = 08h00 UTC
    expect(summer?.start_at).toBe('2026-07-15T08:00:00.000Z');
    expect(summer?.end_at).toBe('2026-07-15T10:00:00.000Z');
    // En décembre (UTC+1), 10h00 Paris = 09h00 UTC
    expect(winter?.start_at).toBe('2026-12-15T09:00:00.000Z');
    expect(winter?.end_at).toBe('2026-12-15T11:00:00.000Z');
  });

  it('3. extrait correctement les événements journée entière (VALUE=DATE) sur 1 jour et sur plusieurs jours', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
BEGIN:VEVENT
UID:ferie-armistice@test
SUMMARY:Armistice 1918
DTSTART;VALUE=DATE:20261111
DTEND;VALUE=DATE:20261112
END:VEVENT
BEGIN:VEVENT
UID:hackathon-multiday@test
SUMMARY:Hackathon Annuel
DTSTART;VALUE=DATE:20261120
DTEND;VALUE=DATE:20261123
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsFeed(ics);
    expect(events).toHaveLength(2);

    const singleDay = events.find((e) => e.ics_uid === 'ferie-armistice@test');
    expect(singleDay?.is_all_day).toBe(true);
    expect(singleDay?.start_at).toBe('2026-11-11');
    expect(singleDay?.end_at).toBe('2026-11-12');

    const multiDay = events.find((e) => e.ics_uid === 'hackathon-multiday@test');
    expect(multiDay?.is_all_day).toBe(true);
    expect(multiDay?.start_at).toBe('2026-11-20');
    expect(multiDay?.end_at).toBe('2026-11-23');
  });

  it("4. applique 'Sans titre' si SUMMARY est absent et calcule une fin de repli si DTEND est omis", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
BEGIN:VEVENT
UID:no-summary-timed@test
DTSTART:20261103T080000Z
END:VEVENT
BEGIN:VEVENT
UID:no-summary-allday@test
DTSTART;VALUE=DATE:20261104
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsFeed(ics);
    const timed = events.find((e) => e.ics_uid === 'no-summary-timed@test');
    expect(timed?.title).toBe('Sans titre');
    expect(timed?.start_at).toBe('2026-11-03T08:00:00.000Z');
    // Repli par défaut d'une heure
    expect(timed?.end_at).toBe('2026-11-03T09:00:00.000Z');

    const allDay = events.find((e) => e.ics_uid === 'no-summary-allday@test');
    expect(allDay?.title).toBe('Sans titre');
    expect(allDay?.is_all_day).toBe(true);
    expect(allDay?.start_at).toBe('2026-11-04');
    expect(allDay?.end_at).toBe('2026-11-05');
  });

  it('5. gère les exceptions RECURRENCE-ID en excluant la date originale du maître et en créant l’occurrence déplacée', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
BEGIN:VEVENT
UID:td-algo@univ.fr
SUMMARY:TD Algorithmique
DTSTART:20261102T100000Z
DTEND:20261102T120000Z
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:td-algo@univ.fr
RECURRENCE-ID:20261109T100000Z
SUMMARY:TD Algorithmique (Salle déplacée)
LOCATION:Salle C102
DTSTART:20261110T140000Z
DTEND:20261110T160000Z
END:VEVENT
END:VCALENDAR`;

    const parsed = parseIcsFeed(ics);
    expect(parsed).toHaveLength(2);

    const master = parsed.find((e) => e.ics_uid === 'td-algo@univ.fr');
    expect(master).toBeDefined();
    const masterExdates = JSON.parse(master!.exdates_json!) as string[];
    expect(masterExdates).toContain('2026-11-09T10:00:00.000Z');

    const override = parsed.find((e) =>
      e.ics_uid.startsWith('td-algo@univ.fr::override-'),
    );
    expect(override).toBeDefined();
    expect(override?.title).toBe('TD Algorithmique (Salle déplacée)');
    expect(override?.location).toBe('Salle C102');
    expect(override?.rrule).toBeNull();
    expect(override?.start_at).toBe('2026-11-10T14:00:00.000Z');
  });

  it('6. rejette proprement un flux ICS vide ou syntaxiquement corrompu', () => {
    expect(() => parseIcsFeed('   ')).toThrow(/vide/i);
    expect(() => parseIcsFeed('NOT AN ICS FILE AT ALL')).toThrow(/invalide/i);
  });

  // ==========================================================================
  // 2. Expansion des événements et récurrences RRULE (AGD-4)
  // ==========================================================================

  it('7. déplie un événement journée entière multi-jours sur chaque jour de la fenêtre', () => {
    const record = makeEventRecord({
      id: 'evt-hackathon',
      title: 'Hackathon',
      start_at: '2026-11-03',
      end_at: '2026-11-06', // 3 jours : 03, 04, 05 novembre
      is_all_day: true,
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-02',
      '2026-11-08',
    );
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
    expect(expanded.every((e) => e.is_all_day && e.readonly)).toBe(true);
    expect(expanded.every((e) => e.start_time_label === null)).toBe(true);
  });

  it('8. déplie une récurrence quotidienne bornée par COUNT (FREQ=DAILY;COUNT=5) en conservant la durée', () => {
    const record = makeEventRecord({
      id: 'evt-standup',
      title: 'Daily Standup',
      start_at: '2026-11-02T09:00:00.000Z',
      end_at: '2026-11-02T09:30:00.000Z',
      rrule: 'FREQ=DAILY;COUNT=5',
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2026-11-15',
    );
    expect(expanded).toHaveLength(5);
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
    for (const occ of expanded) {
      const durationMinutes =
        (Date.parse(occ.end_at) - Date.parse(occ.start_at)) / 60000;
      expect(durationMinutes).toBe(30);
      expect(occ.is_recurring).toBe(true);
      expect(occ.readonly).toBe(true);
    }
  });

  it('9. déplie une récurrence hebdomadaire sur plusieurs jours (FREQ=WEEKLY;BYDAY=MO,WE,FR)', () => {
    const record = makeEventRecord({
      id: 'evt-sport',
      title: 'Entraînement course',
      // 2026-11-02 est un Lundi
      start_at: '2026-11-02T17:00:00.000Z',
      end_at: '2026-11-02T18:30:00.000Z',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-02',
      '2026-11-08',
    );
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-02', // Lundi
      '2026-11-04', // Mercredi
      '2026-11-06', // Vendredi
    ]);
  });

  it('10. déplie une récurrence bi-hebdomadaire (FREQ=WEEKLY;INTERVAL=2;BYDAY=TU)', () => {
    const record = makeEventRecord({
      id: 'evt-biweekly',
      title: 'Point tuteur',
      // Mardi 3 novembre 2026
      start_at: '2026-11-03T13:00:00.000Z',
      end_at: '2026-11-03T14:00:00.000Z',
      rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2026-11-30',
    );
    // Semaine 1 (3 nov), Semaine 3 (17 nov) — saute le 10 nov et le 24 nov
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-03',
      '2026-11-17',
    ]);
  });

  it('11. déplie une récurrence mensuelle (FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3)', () => {
    const record = makeEventRecord({
      id: 'evt-monthly',
      title: 'Loyer & Bilan mensuel',
      start_at: '2026-11-15',
      end_at: '2026-11-16',
      is_all_day: true,
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3',
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2027-02-01',
    );
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('12. respecte la borne de fin UNTIL dans une règle RRULE', () => {
    const record = makeEventRecord({
      id: 'evt-until',
      title: 'Cours intensif',
      start_at: '2026-11-02T10:00:00.000Z',
      end_at: '2026-11-02T12:00:00.000Z',
      rrule: 'FREQ=DAILY;UNTIL=20261104T235959Z',
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2026-11-10',
    );
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('13. exclut strictement une séance tombant sur un jour férié via EXDATE tout en affichant les autres semaines (AGD-4)', () => {
    // Cours tous les mercredis de novembre 2026 (4, 11, 18, 25 nov) avec EXDATE le 11 novembre (Armistice)
    const record = makeEventRecord({
      id: 'evt-mercredi',
      title: 'TD Réseaux',
      start_at: '2026-11-04T09:00:00.000Z',
      end_at: '2026-11-04T11:00:00.000Z',
      rrule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=4',
      exdates_json: JSON.stringify(['2026-11-11T09:00:00.000Z']),
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2026-11-30',
    );
    const days = expanded.map((e) => e.day_key);
    expect(days).toEqual(['2026-11-04', '2026-11-18', '2026-11-25']);
    expect(days).not.toContain('2026-11-11');
  });

  it('14. exclut une date EXDATE au format YYYY-MM-DD sur un événement récurrent journée entière', () => {
    const record = makeEventRecord({
      id: 'evt-permanence',
      title: 'Permanence bibliothèque',
      start_at: '2026-11-02',
      end_at: '2026-11-03',
      is_all_day: true,
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3',
      exdates_json: JSON.stringify(['2026-11-09']),
    });

    const expanded = expandCalendarEventsForRange(
      [record],
      '2026-11-01',
      '2026-11-30',
    );
    expect(expanded.map((e) => e.day_key)).toEqual([
      '2026-11-02',
      '2026-11-16',
    ]);
  });

  // ==========================================================================
  // 3. Superposition des échéances de tâches (AGD-6)
  // ==========================================================================

  it('15. fusionne et distingue clairement les événements ICS (readonly: true) et les échéances de tâches (AGD-6)', () => {
    const events = expandCalendarEventsForRange(
      [
        makeEventRecord({
          id: 'evt-1',
          title: 'Cours SGBD',
          start_at: '2026-11-02T09:00:00.000Z',
          end_at: '2026-11-02T11:00:00.000Z',
          location: 'Amphi A',
        }),
      ],
      '2026-11-02',
      '2026-11-02',
    );

    const tasks: TaskRecord[] = [
      makeTaskRecord({
        id: 'task-1',
        title: 'Rendre le TP SGBD',
        due_date: '2026-11-02',
        has_due_time: false,
        priority: 3,
        category_id: 'cat-ecole',
      }),
    ];

    const merged = mergeEventsAndTaskDeadlines(
      events,
      tasks,
      '2026-11-02',
      '2026-11-02',
    );
    expect(merged).toHaveLength(2);

    const deadlineItem = merged.find((i) => i.kind === 'task_deadline');
    const eventItem = merged.find((i) => i.kind === 'ics_event');

    expect(deadlineItem).toBeDefined();
    expect(deadlineItem?.kind).toBe('task_deadline');
    expect(deadlineItem?.readonly).toBe(false);
    if (deadlineItem?.kind === 'task_deadline') {
      expect(deadlineItem.task_id).toBe('task-1');
      expect(deadlineItem.priority).toBe(3);
      expect(deadlineItem.category_id).toBe('cat-ecole');
      expect(deadlineItem.is_all_day).toBe(true);
    }

    expect(eventItem).toBeDefined();
    expect(eventItem?.kind).toBe('ics_event');
    expect(eventItem?.readonly).toBe(true);
  });

  it('16. trie chronologiquement la timeline : journée entière en premier, puis par heure de début/échéance', () => {
    const events = expandCalendarEventsForRange(
      [
        makeEventRecord({
          id: 'evt-afternoon',
          title: 'TP Après-midi',
          start_at: '2026-11-02T14:00:00',
          end_at: '2026-11-02T16:00:00',
        }),
        makeEventRecord({
          id: 'evt-allday',
          title: 'Journée portes ouvertes',
          start_at: '2026-11-02',
          end_at: '2026-11-03',
          is_all_day: true,
        }),
        makeEventRecord({
          id: 'evt-morning',
          title: 'CM Matin',
          start_at: '2026-11-02T08:30:00',
          end_at: '2026-11-02T10:30:00',
        }),
      ],
      '2026-11-02',
      '2026-11-02',
    );

    const tasks: TaskRecord[] = [
      makeTaskRecord({
        id: 'task-noon',
        title: 'Déposer rapport en ligne',
        due_date: '2026-11-02T12:00',
        has_due_time: true,
        priority: 3,
      }),
      makeTaskRecord({
        id: 'task-allday',
        title: 'Lire article scientifique',
        due_date: '2026-11-02',
        has_due_time: false,
        priority: 2,
      }),
    ];

    const timeline = mergeEventsAndTaskDeadlines(
      events,
      tasks,
      '2026-11-02',
      '2026-11-02',
    );

    expect(timeline.map((i) => i.title)).toEqual([
      'Journée portes ouvertes', // journée entière (ics_event avant task_deadline)
      'Lire article scientifique', // échéance sans heure
      'CM Matin', // 08:30
      'Déposer rapport en ligne', // 12:00
      'TP Après-midi', // 14:00
    ]);
  });

  it('17. exclut les tâches supprimées logiquement (deleted_at !== null), annulées (status === cancelled) ou sans échéance', () => {
    const tasks: TaskRecord[] = [
      makeTaskRecord({
        id: 'task-active',
        title: 'Tâche active valide',
        due_date: '2026-11-02',
      }),
      makeTaskRecord({
        id: 'task-deleted',
        title: 'Tâche supprimée',
        due_date: '2026-11-02',
        deleted_at: '2026-11-01T12:00:00Z',
      }),
      makeTaskRecord({
        id: 'task-cancelled',
        title: 'Tâche annulée',
        due_date: '2026-11-02',
        status: 'cancelled',
      }),
      makeTaskRecord({
        id: 'task-no-due',
        title: 'Tâche sans date',
        due_date: null,
      }),
    ];

    const merged = mergeEventsAndTaskDeadlines(
      [],
      tasks,
      '2026-11-01',
      '2026-11-05',
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Tâche active valide');
  });

  it('18. alimente getAgendaForDay et getDaysWithAgendaItems avec les compteurs exacts par jour', () => {
    const events: CalendarEventRecord[] = [
      makeEventRecord({
        id: 'evt-1',
        title: 'Cours Lundi',
        start_at: '2026-11-02T09:00:00',
        end_at: '2026-11-02T11:00:00',
      }),
      makeEventRecord({
        id: 'evt-2',
        title: 'Cours Mercredi',
        start_at: '2026-11-04T14:00:00',
        end_at: '2026-11-04T16:00:00',
      }),
    ];
    const tasks: TaskRecord[] = [
      makeTaskRecord({
        id: 't-1',
        title: 'Devoir Lundi',
        due_date: '2026-11-02',
      }),
      makeTaskRecord({
        id: 't-2',
        title: 'Projet Vendredi',
        due_date: '2026-11-06',
      }),
    ];

    const mondaySummary = getAgendaForDay(events, tasks, '2026-11-02');
    expect(mondaySummary.eventCount).toBe(1);
    expect(mondaySummary.deadlineCount).toBe(1);
    expect(mondaySummary.totalCount).toBe(2);

    const mapByDay = getDaysWithAgendaItems(
      events,
      tasks,
      '2026-11-02',
      '2026-11-08',
    );
    expect(mapByDay.get('2026-11-02')?.eventCount).toBe(1);
    expect(mapByDay.get('2026-11-02')?.deadlineCount).toBe(1);
    expect(mapByDay.get('2026-11-04')?.eventCount).toBe(1);
    expect(mapByDay.get('2026-11-04')?.deadlineCount).toBe(0);
    expect(mapByDay.get('2026-11-06')?.eventCount).toBe(0);
    expect(mapByDay.get('2026-11-06')?.deadlineCount).toBe(1);
    expect(mapByDay.has('2026-11-03')).toBe(false);
  });

  // ==========================================================================
  // 4. Synchronisation de haut niveau & résilience hors-ligne (AGD-1, AGD-5)
  // ==========================================================================

  it('19. synchronise de bout en bout une source ICS fichier via syncCalendarSourceById', async () => {
    const source = await createCalendarSource({
      name: 'Emploi du temps Master',
      source_type: 'file',
      raw_ics_content: SAMPLE_UNIVERSITY_ICS,
      refresh_interval_minutes: 30,
    });

    const syncResult = await syncCalendarSourceById(source.id);
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(2);
    expect(syncResult.error).toBeNull();

    const cached = await listCalendarEvents(source.id);
    expect(cached).toHaveLength(2);

    const sources = await listCalendarSources();
    expect(sources[0].last_synced_at).not.toBeNull();
    expect(sources[0].last_error).toBeNull();
  });

  it('20. préserve strictement les événements en cache local si une synchronisation ultérieure échoue (AGD-5)', async () => {
    const source = await createCalendarSource({
      name: 'Calendrier Réseau',
      source_type: 'file',
      raw_ics_content: SAMPLE_UNIVERSITY_ICS,
      refresh_interval_minutes: 30,
    });

    // 1re synchro réussie : 2 événements en cache
    const firstSync = await syncCalendarSourceById(source.id);
    expect(firstSync.success).toBe(true);
    expect(firstSync.events).toHaveLength(2);

    // On remplace le contenu du fichier par un flux ICS corrompu
    await updateCalendarSource({
      id: source.id,
      raw_ics_content: 'INVALID CORRUPTED ICS PAYLOAD',
    });

    // 2e synchro en échec : ne doit JAMAIS supprimer les 2 événements déjà en cache (AGD-5)
    const secondSync = await syncCalendarSourceById(source.id);
    expect(secondSync.success).toBe(false);
    expect(secondSync.preservedOfflineCache).toBe(true);
    expect(secondSync.events).toHaveLength(2);
    expect(secondSync.error).toMatch(/invalide/i);

    const cachedAfterFailure = await listCalendarEvents(source.id);
    expect(cachedAfterFailure).toHaveLength(2);

    const updatedSources = await listCalendarSources();
    expect(updatedSources[0].last_error).toMatch(/invalide/i);
  });

  it('21. synchronise uniquement les sources échues lorsque syncAllCalendarSources({ onlyDue: true }) est utilisé', async () => {
    const src1 = await createCalendarSource({
      name: 'Source 1',
      source_type: 'file',
      raw_ics_content: SAMPLE_UNIVERSITY_ICS,
      refresh_interval_minutes: 30,
    });

    // Premier sync complet
    const firstRun = await syncAllCalendarSources({ onlyDue: true });
    expect(firstRun.syncedSourcesCount).toBe(1);
    expect(firstRun.skippedSourcesCount).toBe(0);

    // 5 minutes plus tard (< 30 min) : la source ne doit pas être re-synchronisée si onlyDue = true
    const sourcesAfterFirst = await listCalendarSources();
    const syncedSource = sourcesAfterFirst.find((s) => s.id === src1.id)!;
    const fiveMinLater = new Date(
      Date.parse(syncedSource.last_synced_at!) + 5 * 60 * 1000,
    );
    expect(isCalendarSourceDueForSync(syncedSource, fiveMinLater)).toBe(false);

    const secondRun = await syncAllCalendarSources({
      onlyDue: true,
      now: fiveMinLater,
    });
    expect(secondRun.syncedSourcesCount).toBe(0);
    expect(secondRun.skippedSourcesCount).toBe(1);

    // 35 minutes plus tard (>= 30 min) : la source est de nouveau échue
    const thirtyFiveMinLater = new Date(
      Date.parse(syncedSource.last_synced_at!) + 35 * 60 * 1000,
    );
    expect(isCalendarSourceDueForSync(syncedSource, thirtyFiveMinLater)).toBe(
      true,
    );

    const thirdRun = await syncAllCalendarSources({
      onlyDue: true,
      now: thirtyFiveMinLater,
    });
    expect(thirdRun.syncedSourcesCount).toBe(1);
  });
});
