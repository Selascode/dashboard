import { beforeEach, describe, expect, it } from 'vitest';
import {
  BROWSER_KEYCHAIN_KEY,
  EXPORT_FORMAT_V1,
  addFocusItem,
  completeTask,
  createCalendarSource,
  createCategory,
  createTask,
  deleteCalendarSource,
  deleteCategory,
  deleteTask,
  exportFullJson,
  fetchCalendarSourceIcs,
  getAppSettings,
  getBrowserKeychainSecret,
  getCategories,
  getDbStatus,
  getSetting,
  getSettingValue,
  getSettings,
  get_setting,
  listBackups,
  listCalendarEvents,
  listCalendarSources,
  listFocusItems,
  listTasks,
  listUncompletedPastFocusItems,
  recordCalendarSourceError,
  removeFocusItem,
  reorderFocusItems,
  resetMemoryFallbackStore,
  restoreTask,
  saveCalendarEventsForSource,
  seedDemoData,
  setBackupDir,
  setSetting,
  setSettingValue,
  set_setting,
  triggerBackup,
  updateCalendarSource,
  updateCategory,
  updateTask,
} from '../db';

describe('Couche d’accès aux données unique (src/lib/db.ts)', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
  });

  it('fournit les paramètres zéro friction et Design System par défaut (theme, active_palette, custom_palettes, user_name)', async () => {
    const settings = await getSettings();
    expect(settings.length).toBeGreaterThanOrEqual(9);

    expect(await getSettingValue('theme', 'light')).toBe('system');
    expect(await getSetting('active_palette')).toBe('coolors-classic');
    expect(await getSetting('custom_palettes')).toEqual([]);
    expect(await getSetting('user_name')).toBe('');
    expect(await getSettingValue('language', 'en')).toBe('fr');
    expect(await getSetting('date_format')).toBe('DD-MM-YYYY');
    expect(await getSetting('quick_capture_panel_collapsed')).toBe(false);
    expect(await getSetting('briefing_mode')).toBe('first_open');
  });

  it('valide les clés date_format, quick_capture_panel_collapsed et briefing_mode', async () => {
    await setSetting('date_format', 'YYYY-MM-DD');
    expect(await getSetting('date_format')).toBe('YYYY-MM-DD');
    await expect(setSetting('date_format', 'YYYY/MM/DD')).rejects.toThrow(
      /Format de date invalide/,
    );

    await setSetting('quick_capture_panel_collapsed', true);
    expect(await getSetting('quick_capture_panel_collapsed')).toBe(true);
  });

  it('expose get_setting et set_setting et valide les valeurs de theme (light|dark|system)', async () => {
    await set_setting('theme', 'dark');
    const darkRec = await get_setting('theme');
    expect(darkRec?.value_json).toBe('"dark"');

    await setSetting('theme', 'light');
    expect(await getSettingValue('theme', 'system')).toBe('light');

    await setSettingValue('user_name', 'Selasi');
    expect(await getSetting('user_name')).toBe('Selasi');

    await expect(setSetting('theme', 'invalid-mode')).rejects.toThrow();
  });

  it('retourne les 5 catégories par défaut avec tokens --cat-1..5 et Inbox protégée [TSK-3]', async () => {
    const categories = await getCategories();
    expect(categories).toHaveLength(5);
    expect(categories.map((c) => c.name)).toEqual([
      'Inbox',
      'École',
      'Sport',
      'Perso',
      'Projets',
    ]);
    expect(categories.map((c) => c.color)).toEqual([
      '--cat-1',
      '--cat-2',
      '--cat-3',
      '--cat-4',
      '--cat-5',
    ]);
    expect(categories[0].is_system).toBe(true);

    await expect(deleteCategory('cat-inbox')).rejects.toThrow(/Inbox/);

    const customCat = await createCategory({
      name: 'Lecture',
      color: '--cat-6',
    });
    expect(customCat.alias).toBe('lecture');
    expect(customCat.color).toBe('--cat-6');

    const updatedCat = await updateCategory({
      id: customCat.id,
      name: 'Lectures & Notes',
    });
    expect(updatedCat.name).toBe('Lectures & Notes');
  });

  it('permet de créer, lister, modifier, compléter, supprimer et restaurer des tâches [TSK-1, TSK-2, TSK-5]', async () => {
    const task = await createTask({
      title: 'Préparer la soutenance',
      notes: 'Diapositives + démo',
      category_id: 'cat-ecole',
      priority: 3,
      due_date: '2026-11-05',
      estimated_minutes: 60,
    });
    expect(task.id).toBeTruthy();
    expect(task.status).toBe('todo');

    const modified = await updateTask({
      id: task.id,
      title: 'Préparer la soutenance finale',
      priority: 2,
    });
    expect(modified.title).toBe('Préparer la soutenance finale');
    expect(modified.priority).toBe(2);

    const done = await completeTask(task.id, true);
    expect(done.status).toBe('done');
    expect(done.completed_at).toBeTruthy();

    await deleteTask(task.id);
    expect(await listTasks()).toHaveLength(0);

    await restoreTask(task.id);
    expect(await listTasks()).toHaveLength(1);
  });

  it('réassigne les tâches à Inbox lors de la suppression d’une catégorie [TSK-3]', async () => {
    const task = await createTask({
      title: 'Lire article',
      category_id: 'cat-ecole',
    });
    await deleteCategory('cat-ecole');
    const tasks = await listTasks();
    expect(tasks.find((t) => t.id === task.id)?.category_id).toBe('cat-inbox');
  });

  it('gère le Focus 5 : ajout, limite de 5, retrait, réordonnancement et synchronisation de complétion [FOC-1, FOC-2]', async () => {
    const day = '2026-11-02';
    const createdTasks = [];
    for (let i = 1; i <= 6; i += 1) {
      createdTasks.push(
        await createTask({
          title: `Priorité ${i}`,
          priority: 2,
        }),
      );
    }

    for (let i = 0; i < 5; i += 1) {
      await addFocusItem(day, createdTasks[i].id);
    }

    const focusItems = await listFocusItems(day);
    expect(focusItems).toHaveLength(5);
    expect(focusItems.map((f) => f.position)).toEqual([1, 2, 3, 4, 5]);

    // 6e ajout refusé [FOC-1]
    await expect(addFocusItem(day, createdTasks[5].id)).rejects.toThrow(/5/);

    // Compléter une tâche met à jour outcome = completed [FOC-2]
    await completeTask(createdTasks[0].id, true);
    const updatedFocus = await listFocusItems(day);
    expect(updatedFocus[0].outcome).toBe('completed');

    // Retrait et renumérotation
    await removeFocusItem(day, createdTasks[1].id);
    const afterRemove = await listFocusItems(day);
    expect(afterRemove).toHaveLength(4);
    expect(afterRemove.map((f) => f.position)).toEqual([1, 2, 3, 4]);

    // Réordonnancement
    const reversedIds = afterRemove.map((f) => f.task_id).reverse();
    const reordered = await reorderFocusItems(day, reversedIds);
    expect(reordered.map((f) => f.task_id)).toEqual(reversedIds);
  });

  it('peuple les données de démo fidèles aux maquettes via seedDemoData', async () => {
    await seedDemoData('2026-11-02');
    const tasks = await listTasks();
    const todoTasks = tasks.filter((t) => t.status !== 'done');
    const doneTasks = tasks.filter((t) => t.status === 'done');
    expect(todoTasks).toHaveLength(8);
    expect(doneTasks).toHaveLength(2);
    expect(await listFocusItems('2026-11-02')).toHaveLength(2);
  });

  it('vérifie le statut de santé de la base en version 4 et les 5 entités synchronisables [Section 6]', async () => {
    const status = await getDbStatus();
    expect(status.schema_version).toBe(4);
    expect(status.tables_verified).toHaveLength(8);
    expect(status.sync_entities_verified).toEqual([
      'categories',
      'tasks',
      'focus_items',
      'launcher_items',
      'commands',
    ]);
  });

  it('liste les éléments Focus non terminés des jours précédents sans les reporter en silence [FOC-3]', async () => {
    const yesterday = '2026-11-01';
    const today = '2026-11-02';

    const t1 = await createTask({ title: 'Tâche veille non finie', priority: 3 });
    const t2 = await createTask({ title: 'Tâche veille terminée', priority: 2 });

    await addFocusItem(yesterday, t1.id);
    await addFocusItem(yesterday, t2.id);
    await completeTask(t2.id, true);

    expect(await listFocusItems(today)).toHaveLength(0);

    const uncompletedPast = await listUncompletedPastFocusItems(today);
    expect(uncompletedPast).toHaveLength(1);
    expect(uncompletedPast[0].task_id).toBe(t1.id);
    expect(uncompletedPast[0].focus_day).toBe(yesterday);
  });

  it('gère les réglages de sauvegarde, triggerBackup, listBackups et exportFullJson en schema_version 4 [BKP-1, BKP-2, BKP-3]', async () => {
    const appSettings = await getAppSettings();
    expect(appSettings.backup_dir).toBe('');
    expect(appSettings.last_auto_backup_date).toBeNull();

    const updatedDir = await setBackupDir('/tmp/focus-backups');
    expect(updatedDir).toBe('/tmp/focus-backups');
    expect(await getSetting('backup_dir')).toBe('/tmp/focus-backups');

    const report = await triggerBackup(true);
    expect(report.performed).toBe(true);
    expect(report.backup_dir).toBe('/tmp/focus-backups');
    expect(report.daily_backup_path).toContain('daily-');
    expect(report.weekly_backup_path).toContain('weekly-');

    const backups = await listBackups();
    expect(backups.length).toBeGreaterThanOrEqual(2);
    expect(backups.some((b) => b.kind === 'daily')).toBe(true);
    expect(backups.some((b) => b.kind === 'weekly')).toBe(true);

    await createTask({ title: 'Tâche à exporter en JSON', priority: 2 });
    const jsonRaw = await exportFullJson();
    const parsed = JSON.parse(jsonRaw);
    expect(parsed.format).toBe(EXPORT_FORMAT_V1);
    expect(parsed.schema_version).toBe(4);
    expect(parsed.categories).toHaveLength(5);
    expect(parsed.tasks).toHaveLength(1);
    expect(Array.isArray(parsed.focus_items)).toBe(true);
    expect(Array.isArray(parsed.settings)).toBe(true);
  });

  it('stocke uniquement keychain:ics_url:<id> pour les sources ICS URL et n’expose jamais l’URL secrète dans SQLite ni dans exportFullJson [PRV-3, AGD-1]', async () => {
    const secretUrl =
      'https://calendar.google.com/calendar/ical/secret-token-xyz123/basic.ics';
    const webcalUrl =
      'webcal://calendar.google.com/calendar/ical/webcal-token-abc987/basic.ics';

    const source = await createCalendarSource({
      name: 'Agenda Université',
      source_type: 'url',
      location: secretUrl,
      refresh_interval_minutes: 15,
    });

    const expectedRef = `keychain:ics_url:${source.id}`;
    expect(source.location_or_keychain_ref).toBe(expectedRef);
    expect(source.location_or_keychain_ref).not.toContain('secret-token-xyz123');
    expect(getBrowserKeychainSecret(expectedRef)).toBe(secretUrl);

    if (typeof window !== 'undefined' && window.localStorage) {
      const dbSnapshotRaw =
        window.localStorage.getItem('focus_browser_db_v2') ?? '';
      expect(dbSnapshotRaw).not.toContain('secret-token-xyz123');
      expect(dbSnapshotRaw).toContain(expectedRef);

      const keychainRaw =
        window.localStorage.getItem(BROWSER_KEYCHAIN_KEY) ?? '';
      expect(keychainRaw).toContain('secret-token-xyz123');
    }

    const exportedJson = await exportFullJson();
    expect(exportedJson).not.toContain('secret-token-xyz123');
    expect(exportedJson).toContain(expectedRef);

    // Mise à jour avec conversion webcal:// -> https://
    const updated = await updateCalendarSource({
      id: source.id,
      name: 'Agenda Master 2',
      location: webcalUrl,
      refresh_interval_minutes: 10,
    });
    expect(updated.name).toBe('Agenda Master 2');
    expect(updated.refresh_interval_minutes).toBe(10);
    expect(updated.location_or_keychain_ref).toBe(expectedRef);
    expect(getBrowserKeychainSecret(expectedRef)).toBe(
      'https://calendar.google.com/calendar/ical/webcal-token-abc987/basic.ics',
    );

    // Suppression de la source et nettoyage du trousseau
    await deleteCalendarSource(source.id);
    expect(getBrowserKeychainSecret(expectedRef)).toBeNull();
    expect(await listCalendarSources()).toHaveLength(0);
  });

  it('synchronise les événements ICS dans calendar_events et préserve le cache local en cas d’erreur réseau ou fichier [AGD-1, AGD-5]', async () => {
    const rawIcs =
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:evt-900\r\nSUMMARY:Soutenance Projet\r\nDTSTART:20261106T140000Z\r\nDTEND:20261106T153000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';

    const fileSource = await createCalendarSource({
      name: 'Calendrier Local',
      source_type: 'file',
      location: 'mon-planning.ics',
      raw_ics_content: rawIcs,
    });

    const fetchedContent = await fetchCalendarSourceIcs(fileSource.id);
    expect(fetchedContent).toContain('UID:evt-900');

    const savedEvents = await saveCalendarEventsForSource(fileSource.id, [
      {
        ics_uid: 'evt-900',
        title: 'Soutenance Projet',
        start_at: '2026-11-06T14:00:00Z',
        end_at: '2026-11-06T15:30:00Z',
        is_all_day: false,
        location: 'Salle B204',
        notes: 'Apporter adaptateur HDMI',
        rrule: null,
        exdates: [],
      },
      {
        ics_uid: 'evt-901',
        title: 'Férié',
        start_at: '2026-11-11',
        end_at: '2026-11-11',
        is_all_day: true,
      },
    ]);

    expect(savedEvents).toHaveLength(2);
    const sourcesAfterSync = await listCalendarSources();
    expect(sourcesAfterSync[0].last_synced_at).toBeTruthy();
    expect(sourcesAfterSync[0].last_error).toBeNull();

    // Enregistrer une erreur de synchronisation : les événements en cache doivent rester intacts [AGD-5]
    const erroredSource = await recordCalendarSourceError(
      fileSource.id,
      'Serveur ICS injoignable (timeout 15s)',
    );
    expect(erroredSource.last_error).toBe(
      'Serveur ICS injoignable (timeout 15s)',
    );
    expect(erroredSource.last_synced_at).toBeTruthy();

    const cachedEvents = await listCalendarEvents(fileSource.id);
    expect(cachedEvents).toHaveLength(2);
    expect(cachedEvents[0].title).toBe('Soutenance Projet');

    // Simuler un échec réel de fetchCalendarSourceIcs (fichier pointant vers un chemin inexistant)
    await updateCalendarSource({
      id: fileSource.id,
      location: '/chemin/inexistant.ics',
    });
    await expect(fetchCalendarSourceIcs(fileSource.id)).rejects.toThrow();

    const cachedAfterFetchFail = await listCalendarEvents(fileSource.id);
    expect(cachedAfterFetchFail).toHaveLength(2);
  });
});
