import { invoke } from '@tauri-apps/api/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SyncMetadata {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

export interface SettingRecord {
  key: string;
  value_json: string;
  updated_at: string;
}

export interface CategoryRecord extends SyncMetadata {
  name: string;
  alias: string;
  color: string;
  position: number;
  is_system: boolean;
}

export interface PurgeReport {
  focus_items_purged: number;
  tasks_purged: number;
  categories_purged: number;
  launcher_items_purged: number;
  commands_purged: number;
  total_purged: number;
}

export interface DbStatus {
  db_path: string;
  schema_version: number;
  tables_verified: string[];
  sync_entities_verified: string[];
  last_purge_report: PurgeReport;
}

export interface DefaultSettingsMap {
  theme: ThemeMode;
  language: 'fr' | 'en';
  briefing_mode: 'first_open' | 'fixed_time';
  briefing_time: string;
  last_briefing_date: string | null;
  global_capture_shortcut: string;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: Record<string, unknown> = {
  theme: 'system',
  language: 'fr',
  briefing_mode: 'first_open',
  briefing_time: '08:00',
  last_briefing_date: null,
  global_capture_shortcut: 'CommandOrControl+Shift+Space',
};

const DEFAULT_CATEGORIES: CategoryRecord[] = [
  {
    id: 'cat-inbox',
    name: 'Inbox',
    alias: 'inbox',
    color: '#64748b',
    position: 0,
    is_system: true,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
  {
    id: 'cat-ecole',
    name: 'École',
    alias: 'ecole',
    color: '#3b82f6',
    position: 1,
    is_system: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
  {
    id: 'cat-sport',
    name: 'Sport',
    alias: 'sport',
    color: '#10b981',
    position: 2,
    is_system: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
  {
    id: 'cat-perso',
    name: 'Perso',
    alias: 'perso',
    color: '#f59e0b',
    position: 3,
    is_system: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
  {
    id: 'cat-projets',
    name: 'Projets',
    alias: 'projets',
    color: '#8b5cf6',
    position: 4,
    is_system: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
];

let memorySettingsStore: Map<string, SettingRecord> = createInitialMemorySettings();

function createInitialMemorySettings(): Map<string, SettingRecord> {
  const now = new Date().toISOString();
  const map = new Map<string, SettingRecord>();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    map.set(key, {
      key,
      value_json: JSON.stringify(value),
      updated_at: now,
    });
  }
  return map;
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export function resetMemoryFallbackStore(): void {
  memorySettingsStore = createInitialMemorySettings();
}

export async function getSettings(): Promise<SettingRecord[]> {
  if (isTauriRuntime()) {
    return invoke<SettingRecord[]>('get_settings');
  }
  return Array.from(memorySettingsStore.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

export async function getSettingRecord(
  key: string,
): Promise<SettingRecord | null> {
  if (isTauriRuntime()) {
    return invoke<SettingRecord | null>('get_setting', { key });
  }
  return memorySettingsStore.get(key) ?? null;
}

export async function getSettingValue<T = unknown>(
  key: string,
  fallbackValue: T,
): Promise<T> {
  const record = await getSettingRecord(key);
  if (!record) {
    return fallbackValue;
  }
  try {
    return JSON.parse(record.value_json) as T;
  } catch {
    return fallbackValue;
  }
}

export async function setSettingValue<T = unknown>(
  key: string,
  value: T,
): Promise<SettingRecord> {
  const valueJson = JSON.stringify(value);
  if (isTauriRuntime()) {
    return invoke<SettingRecord>('set_setting', {
      key,
      valueJson,
    });
  }
  const record: SettingRecord = {
    key,
    value_json: valueJson,
    updated_at: new Date().toISOString(),
  };
  memorySettingsStore.set(key, record);
  return record;
}

export async function getCategories(): Promise<CategoryRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CategoryRecord[]>('get_categories');
  }
  return DEFAULT_CATEGORIES.map((category) => ({ ...category }));
}

export async function getDbStatus(): Promise<DbStatus> {
  if (isTauriRuntime()) {
    return invoke<DbStatus>('get_db_status');
  }
  return {
    db_path: 'memory://dashboard.db',
    schema_version: 1,
    tables_verified: [
      'categories',
      'tasks',
      'focus_items',
      'calendar_sources',
      'calendar_events',
      'launcher_items',
      'commands',
      'settings',
    ],
    sync_entities_verified: [
      'categories',
      'tasks',
      'focus_items',
      'launcher_items',
      'commands',
    ],
    last_purge_report: {
      focus_items_purged: 0,
      tasks_purged: 0,
      categories_purged: 0,
      launcher_items_purged: 0,
      commands_purged: 0,
      total_purged: 0,
    },
  };
}
