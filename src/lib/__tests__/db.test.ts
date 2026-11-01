import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCategories,
  getDbStatus,
  getSettingValue,
  getSettings,
  resetMemoryFallbackStore,
  setSettingValue,
} from '../db';

describe('Couche d’accès aux données unique (src/lib/db.ts)', () => {
  beforeEach(() => {
    resetMemoryFallbackStore();
  });

  it('fournit les paramètres zéro friction par défaut au premier lancement', async () => {
    const settings = await getSettings();
    expect(settings.length).toBeGreaterThanOrEqual(6);

    const theme = await getSettingValue('theme', 'light');
    expect(theme).toBe('system');

    const language = await getSettingValue('language', 'en');
    expect(language).toBe('fr');
  });

  it('permet de modifier et relire un paramètre typé', async () => {
    await setSettingValue('theme', 'dark');
    const updatedTheme = await getSettingValue('theme', 'system');
    expect(updatedTheme).toBe('dark');
  });

  it('retourne les 5 catégories par défaut avec Inbox marquée système [TSK-3]', async () => {
    const categories = await getCategories();
    expect(categories).toHaveLength(5);
    expect(categories.map((c) => c.name)).toEqual([
      'Inbox',
      'École',
      'Sport',
      'Perso',
      'Projets',
    ]);
    expect(categories[0].is_system).toBe(true);
    for (const cat of categories) {
      expect(cat.id).toBeTruthy();
      expect(cat.created_at).toBeTruthy();
      expect(cat.updated_at).toBeTruthy();
      expect(cat.deleted_at).toBeNull();
      expect(cat.device_id).toBeTruthy();
    }
  });

  it('vérifie le statut de santé de la base et les 5 entités synchronisables [Section 6]', async () => {
    const status = await getDbStatus();
    expect(status.schema_version).toBe(1);
    expect(status.tables_verified).toHaveLength(8);
    expect(status.sync_entities_verified).toEqual([
      'categories',
      'tasks',
      'focus_items',
      'launcher_items',
      'commands',
    ]);
  });
});
