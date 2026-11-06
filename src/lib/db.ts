import { invoke } from '@tauri-apps/api/core';
import demoSeedState from './demo-seed-state.json';

export type ThemeMode = 'light' | 'dark' | 'system';

export type DateFormat = 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
export type DateFormatPreference = DateFormat;

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export type FocusOutcome = 'completed' | 'carried_over' | 'abandoned' | null;

export interface PaletteColors {
  darkest: string;
  dark: string;
  mid: string;
  light: string;
  lightest: string;
}

export interface PaletteOverrides {
  light?: Partial<Record<string, string>>;
  dark?: Partial<Record<string, string>>;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: PaletteColors;
  overrides?: PaletteOverrides;
}

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

export interface CreateCategoryInput {
  name: string;
  alias?: string;
  color?: string;
  position?: number;
}

export interface UpdateCategoryInput {
  id: string;
  name?: string;
  alias?: string;
  color?: string;
  position?: number;
}

export interface TaskRecord extends SyncMetadata {
  title: string;
  notes: string;
  category_id: string;
  status: TaskStatus;
  priority: number;
  due_date: string | null;
  has_due_time: boolean;
  estimated_minutes: number | null;
  completed_at: string | null;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  category_id?: string;
  status?: TaskStatus;
  priority?: number;
  due_date?: string | null;
  has_due_time?: boolean;
  estimated_minutes?: number | null;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  notes?: string;
  category_id?: string;
  status?: TaskStatus;
  priority?: number;
  due_date?: string | null;
  clear_due_date?: boolean;
  has_due_time?: boolean;
  estimated_minutes?: number | null;
  clear_estimated_minutes?: boolean;
}

export interface FocusItemRecord extends SyncMetadata {
  focus_day: string;
  task_id: string;
  position: number;
  outcome: FocusOutcome;
}

export type CalendarSourceType = 'file' | 'url';

export interface CalendarSourceRecord {
  id: string;
  name: string;
  source_type: CalendarSourceType;
  location_or_keychain_ref: string;
  refresh_interval_minutes: number;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarSourceInput {
  name: string;
  source_type: CalendarSourceType;
  location?: string;
  refresh_interval_minutes?: number;
  raw_ics_content?: string;
}

export interface UpdateCalendarSourceInput {
  id: string;
  name?: string;
  location?: string;
  refresh_interval_minutes?: number;
  raw_ics_content?: string;
}

export interface CalendarEventRecord {
  id: string;
  source_id: string;
  ics_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  location: string;
  notes: string;
  rrule: string | null;
  exdates_json: string;
}

export interface CalendarEventInput {
  id?: string;
  ics_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  is_all_day?: boolean;
  location?: string;
  notes?: string;
  rrule?: string | null;
  exdates_json?: string;
  exdates?: string[];
}

export interface PurgeReport {
  focus_items_purged: number;
  tasks_purged: number;
  categories_purged: number;
  launcher_items_purged: number;
  commands_purged: number;
  total_purged: number;
}

export interface RotationReport {
  daily_kept: number;
  daily_deleted: number;
  weekly_kept: number;
  weekly_deleted: number;
  deleted_files: string[];
}

export interface BackupReport {
  performed: boolean;
  backup_dir: string;
  daily_backup_path: string | null;
  weekly_backup_path: string | null;
  backup_date: string;
  rotation: RotationReport;
}

export interface BackupFileInfo {
  filename: string;
  path: string;
  kind: 'daily' | 'weekly' | 'pre_migration' | string;
  size_bytes: number;
  modified_at: string;
}

export interface FullDatabaseExport {
  format: string;
  schema_version: number;
  exported_at: string;
  categories: CategoryRecord[];
  tasks: TaskRecord[];
  focus_items: FocusItemRecord[];
  calendar_sources: CalendarSourceRecord[];
  calendar_events: CalendarEventRecord[];
  launcher_items: unknown[];
  commands: unknown[];
  settings: SettingRecord[];
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
  active_palette: string;
  custom_palettes: ColorPalette[];
  user_name: string;
  language: 'fr' | 'en';
  date_format: DateFormat;
  quick_capture_panel_collapsed: boolean;
  briefing_mode: 'first_open' | 'fixed_time';
  briefing_time: string;
  last_briefing_date: string | null;
  global_capture_shortcut: string;
  backup_dir: string;
  last_auto_backup_date: string | null;
  [key: string]: unknown;
}

export type AppSettings = DefaultSettingsMap;
export type UpdateSettingsInput = Partial<DefaultSettingsMap>;

const BROWSER_STORAGE_KEY = 'focus_browser_db_v2';
export const BROWSER_KEYCHAIN_KEY = 'focus_browser_keychain_v1';
export const KEYCHAIN_ICS_URL_PREFIX = 'keychain:ics_url:';

const DEFAULT_SETTINGS: DefaultSettingsMap = {
  theme: 'system',
  active_palette: 'coolors-classic',
  custom_palettes: [],
  user_name: '',
  language: 'fr',
  date_format: 'DD-MM-YYYY',
  quick_capture_panel_collapsed: false,
  briefing_mode: 'first_open',
  briefing_time: '08:00',
  last_briefing_date: null,
  global_capture_shortcut: 'CommandOrControl+Shift+Space',
  backup_dir: '',
  last_auto_backup_date: null,
};

const DEFAULT_CATEGORIES: CategoryRecord[] = [
  {
    id: 'cat-inbox',
    name: 'Inbox',
    alias: 'inbox',
    color: '--cat-1',
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
    color: '--cat-2',
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
    color: '--cat-3',
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
    color: '--cat-4',
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
    color: '--cat-5',
    position: 4,
    is_system: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
    device_id: 'local-init',
  },
];

interface BrowserDbSnapshot {
  settings: Record<string, SettingRecord>;
  categories: CategoryRecord[];
  tasks: TaskRecord[];
  focusItems: FocusItemRecord[];
  calendarSources?: CalendarSourceRecord[];
  calendarEvents?: CalendarEventRecord[];
  icsFiles?: Record<string, string>;
  backups?: BackupFileInfo[];
}

let memorySettingsStore: Map<string, SettingRecord> = new Map();
let memoryCategoriesStore: Map<string, CategoryRecord> = new Map();
let memoryTasksStore: Map<string, TaskRecord> = new Map();
let memoryFocusStore: Map<string, FocusItemRecord> = new Map();
let memoryCalendarSourcesStore: Map<string, CalendarSourceRecord> = new Map();
let memoryCalendarEventsStore: Map<string, CalendarEventRecord> = new Map();
let memoryIcsFilesStore: Map<string, string> = new Map();
let memoryKeychainStore: Map<string, string> = new Map();
let memoryBackupsStore: BackupFileInfo[] = [];
let memoryCounter = 1;

function nextId(prefix: string): string {
  memoryCounter += 1;
  return `${prefix}-${Date.now()}-${memoryCounter}`;
}

function createInitialSettingsMap(): Map<string, SettingRecord> {
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

function createInitialCategoriesMap(): Map<string, CategoryRecord> {
  const map = new Map<string, CategoryRecord>();
  for (const cat of DEFAULT_CATEGORIES) {
    map.set(cat.id, { ...cat });
  }
  return map;
}

function saveBrowserKeychainToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const obj = Object.fromEntries(memoryKeychainStore.entries());
    window.localStorage.setItem(BROWSER_KEYCHAIN_KEY, JSON.stringify(obj));
  } catch {
    // Ignorer en environnement restreint
  }
}

function loadBrowserKeychainFromStorage(): void {
  memoryKeychainStore = new Map();
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(BROWSER_KEYCHAIN_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          memoryKeychainStore.set(k, v);
        }
      }
    }
  } catch {
    // Ignorer en environnement restreint
  }
}

function saveBrowserStoreToLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const snapshot: BrowserDbSnapshot = {
      settings: Object.fromEntries(memorySettingsStore.entries()),
      categories: Array.from(memoryCategoriesStore.values()),
      tasks: Array.from(memoryTasksStore.values()),
      focusItems: Array.from(memoryFocusStore.values()),
      calendarSources: Array.from(memoryCalendarSourcesStore.values()),
      calendarEvents: Array.from(memoryCalendarEventsStore.values()),
      icsFiles: Object.fromEntries(memoryIcsFilesStore.entries()),
      backups: [...memoryBackupsStore],
    };
    window.localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignorer en environnement restreint
  }
}

function loadBrowserStoreFromLocalStorage(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    loadBrowserKeychainFromStorage();
    const raw = window.localStorage.getItem(BROWSER_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as Partial<BrowserDbSnapshot>;
    memorySettingsStore = createInitialSettingsMap();
    if (parsed.settings) {
      for (const [k, v] of Object.entries(parsed.settings)) {
        memorySettingsStore.set(k, v);
      }
    }
    memoryCategoriesStore = createInitialCategoriesMap();
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      memoryCategoriesStore.clear();
      for (const c of parsed.categories) {
        memoryCategoriesStore.set(c.id, c);
      }
    }
    memoryTasksStore = new Map();
    if (Array.isArray(parsed.tasks)) {
      for (const t of parsed.tasks) {
        memoryTasksStore.set(t.id, t);
      }
    }
    memoryFocusStore = new Map();
    if (Array.isArray(parsed.focusItems)) {
      for (const f of parsed.focusItems) {
        memoryFocusStore.set(f.id, f);
      }
    }
    memoryCalendarSourcesStore = new Map();
    if (Array.isArray(parsed.calendarSources)) {
      for (const s of parsed.calendarSources) {
        memoryCalendarSourcesStore.set(s.id, s);
      }
    }
    memoryCalendarEventsStore = new Map();
    if (Array.isArray(parsed.calendarEvents)) {
      for (const e of parsed.calendarEvents) {
        memoryCalendarEventsStore.set(e.id, e);
      }
    }
    memoryIcsFilesStore = new Map();
    if (parsed.icsFiles && typeof parsed.icsFiles === 'object') {
      for (const [k, v] of Object.entries(parsed.icsFiles)) {
        if (typeof v === 'string') {
          memoryIcsFilesStore.set(k, v);
        }
      }
    }
    memoryBackupsStore = Array.isArray(parsed.backups) ? parsed.backups : [];
    return true;
  } catch {
    return false;
  }
}

function applyDemoSeedSync(
  onlyProfile = false,
  customRefDate?: string,
): void {
  const now = '2026-11-02T08:00:00Z';
  const refDate =
    customRefDate || demoSeedState.referenceDate || '2026-11-02';
  memorySettingsStore.set('user_name', {
    key: 'user_name',
    value_json: JSON.stringify(demoSeedState.userName || 'Selasi'),
    updated_at: now,
  });

  if (onlyProfile) {
    return;
  }

  const demoTasks: TaskRecord[] = [
    {
      id: 'demo-task-1',
      title: 'Réviser le chapitre de statistiques',
      notes: 'Chapitre 4',
      category_id: 'cat-ecole',
      status: 'todo',
      priority: 3,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: 45,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-2',
      title: 'Finaliser les wireframes du portfolio',
      notes: "Page d'accueil",
      category_id: 'cat-projets',
      status: 'todo',
      priority: 3,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: 60,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-3',
      title: 'Faire une sortie de 5 km',
      notes: "Prendre l'air",
      category_id: 'cat-sport',
      status: 'todo',
      priority: 2,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: 30,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-4',
      title: 'Appeler le dentiste',
      notes: 'Prendre rendez-vous',
      category_id: 'cat-perso',
      status: 'todo',
      priority: 1,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: 10,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-5',
      title: 'Envoyer le dossier de candidature',
      notes: 'Relire la lettre et joindre le CV',
      category_id: 'cat-ecole',
      status: 'todo',
      priority: 2,
      due_date: '2026-11-04',
      has_due_time: false,
      estimated_minutes: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-6',
      title: 'Préparer la présentation du projet',
      notes: 'Rassembler les premières idées',
      category_id: 'cat-projets',
      status: 'todo',
      priority: 2,
      due_date: '2026-11-05',
      has_due_time: false,
      estimated_minutes: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-7',
      title: 'Réserver les billets pour le week-end',
      notes: 'Comparer les horaires de train',
      category_id: 'cat-perso',
      status: 'todo',
      priority: 1,
      due_date: '2026-11-06',
      has_due_time: false,
      estimated_minutes: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-8',
      title: 'Trier mes notes et idées',
      notes: 'Faire un peu de place dans mes idées',
      category_id: 'cat-inbox',
      status: 'todo',
      priority: 0,
      due_date: null,
      has_due_time: false,
      estimated_minutes: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-9',
      title: 'Installer l’environnement de travail',
      notes: 'Configuration initiale',
      category_id: 'cat-projets',
      status: 'done',
      priority: 1,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: null,
      completed_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
    {
      id: 'demo-task-10',
      title: 'Organiser les dossiers du semestre',
      notes: 'Cours et TD',
      category_id: 'cat-ecole',
      status: 'done',
      priority: 1,
      due_date: refDate,
      has_due_time: false,
      estimated_minutes: null,
      completed_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      device_id: 'demo-device',
    },
  ];

  for (const t of demoTasks) {
    memoryTasksStore.set(t.id, t);
  }

  memoryFocusStore.set('demo-focus-1', {
    id: 'demo-focus-1',
    focus_day: refDate,
    task_id: 'demo-task-1',
    position: 1,
    outcome: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: 'demo-device',
  });
  memoryFocusStore.set('demo-focus-2', {
    id: 'demo-focus-2',
    focus_day: refDate,
    task_id: 'demo-task-2',
    position: 2,
    outcome: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: 'demo-device',
  });
}

function initializeMemoryStores(): void {
  const isTestEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test';
  const searchParams =
    typeof window !== 'undefined' && window.location
      ? new URLSearchParams(window.location.search)
      : null;
  const forceEmptyTasks = searchParams?.get('empty') === '1';

  if (!isTestEnv && demoSeedState.seeded) {
    memorySettingsStore = createInitialSettingsMap();
    memoryCategoriesStore = createInitialCategoriesMap();
    memoryTasksStore = new Map();
    memoryFocusStore = new Map();
    memoryCalendarSourcesStore = new Map();
    memoryCalendarEventsStore = new Map();
    memoryIcsFilesStore = new Map();
    memoryKeychainStore = new Map();
    applyDemoSeedSync(forceEmptyTasks);
    return;
  }

  if (!loadBrowserStoreFromLocalStorage()) {
    memorySettingsStore = createInitialSettingsMap();
    memoryCategoriesStore = createInitialCategoriesMap();
    memoryTasksStore = new Map();
    memoryFocusStore = new Map();
    memoryCalendarSourcesStore = new Map();
    memoryCalendarEventsStore = new Map();
    memoryIcsFilesStore = new Map();
    memoryKeychainStore = new Map();
  }
}

initializeMemoryStores();

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export function resetMemoryFallbackStore(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(BROWSER_STORAGE_KEY);
      window.localStorage.removeItem(BROWSER_KEYCHAIN_KEY);
    } catch {
      // ignore
    }
  }
  memorySettingsStore = createInitialSettingsMap();
  memoryCategoriesStore = createInitialCategoriesMap();
  memoryTasksStore = new Map();
  memoryFocusStore = new Map();
  memoryCalendarSourcesStore = new Map();
  memoryCalendarEventsStore = new Map();
  memoryIcsFilesStore = new Map();
  memoryKeychainStore = new Map();
  memoryBackupsStore = [];
}

// ============================================================================
// Settings API
// ============================================================================

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

export async function get_setting(key: string): Promise<SettingRecord | null> {
  return getSettingRecord(key);
}

export async function getSetting<T = unknown>(
  key: string,
  fallbackValue?: T,
): Promise<T> {
  const defaultVal =
    fallbackValue !== undefined
      ? fallbackValue
      : (DEFAULT_SETTINGS[key] as T);
  return getSettingValue<T>(key, defaultVal);
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
  if (!key.trim()) {
    throw new Error('La clé de paramètre ne peut pas être vide.');
  }
  if (key === 'theme' && value !== 'light' && value !== 'dark' && value !== 'system') {
    throw new Error(`Valeur de thème invalide : ${String(value)}`);
  }
  if (
    key === 'date_format' &&
    value !== 'DD-MM-YYYY' &&
    value !== 'MM-DD-YYYY' &&
    value !== 'YYYY-MM-DD'
  ) {
    throw new Error(`Format de date invalide : ${String(value)}`);
  }
  if (
    key === 'briefing_mode' &&
    value !== 'first_open' &&
    value !== 'fixed_time'
  ) {
    throw new Error(`Mode de briefing invalide : ${String(value)}`);
  }
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
  saveBrowserStoreToLocalStorage();
  return record;
}

export async function setSetting<T = unknown>(
  key: string,
  value: T,
): Promise<SettingRecord> {
  return setSettingValue(key, value);
}

export async function set_setting<T = unknown>(
  key: string,
  value: T,
): Promise<SettingRecord> {
  return setSettingValue(key, value);
}

export async function getAppSettings(): Promise<AppSettings> {
  const [
    theme,
    active_palette,
    custom_palettes,
    user_name,
    language,
    date_format,
    quick_capture_panel_collapsed,
    briefing_mode,
    briefing_time,
    last_briefing_date,
    global_capture_shortcut,
    backup_dir,
    last_auto_backup_date,
  ] = await Promise.all([
    getSettingValue<ThemeMode>('theme', DEFAULT_SETTINGS.theme),
    getSettingValue<string>('active_palette', DEFAULT_SETTINGS.active_palette),
    getSettingValue<ColorPalette[]>(
      'custom_palettes',
      DEFAULT_SETTINGS.custom_palettes,
    ),
    getSettingValue<string>('user_name', DEFAULT_SETTINGS.user_name),
    getSettingValue<'fr' | 'en'>('language', DEFAULT_SETTINGS.language),
    getSettingValue<DateFormat>('date_format', DEFAULT_SETTINGS.date_format),
    getSettingValue<boolean>(
      'quick_capture_panel_collapsed',
      DEFAULT_SETTINGS.quick_capture_panel_collapsed,
    ),
    getSettingValue<'first_open' | 'fixed_time'>(
      'briefing_mode',
      DEFAULT_SETTINGS.briefing_mode,
    ),
    getSettingValue<string>('briefing_time', DEFAULT_SETTINGS.briefing_time),
    getSettingValue<string | null>(
      'last_briefing_date',
      DEFAULT_SETTINGS.last_briefing_date,
    ),
    getSettingValue<string>(
      'global_capture_shortcut',
      DEFAULT_SETTINGS.global_capture_shortcut,
    ),
    getSettingValue<string>('backup_dir', DEFAULT_SETTINGS.backup_dir),
    getSettingValue<string | null>(
      'last_auto_backup_date',
      DEFAULT_SETTINGS.last_auto_backup_date,
    ),
  ]);

  return {
    theme,
    active_palette,
    custom_palettes,
    user_name,
    language,
    date_format,
    quick_capture_panel_collapsed,
    briefing_mode,
    briefing_time,
    last_briefing_date,
    global_capture_shortcut,
    backup_dir,
    last_auto_backup_date,
  };
}

export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<SettingRecord[]> {
  const results: SettingRecord[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      results.push(await setSettingValue(key, value));
    }
  }
  return results;
}

// ============================================================================
// Categories API [TSK-3]
// ============================================================================

export async function listCategories(): Promise<CategoryRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CategoryRecord[]>('list_categories');
  }
  return Array.from(memoryCategoriesStore.values())
    .filter((cat) => cat.deleted_at === null)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ ...c }));
}

export async function getCategories(): Promise<CategoryRecord[]> {
  return listCategories();
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryRecord> {
  if (isTauriRuntime()) {
    return invoke<CategoryRecord>('create_category', { input });
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error('Le nom de la catégorie est obligatoire.');
  }
  const active = await listCategories();
  const maxPos = active.reduce((max, c) => Math.max(max, c.position), 0);
  const now = new Date().toISOString();
  const alias =
    input.alias?.trim().toLowerCase() ||
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const record: CategoryRecord = {
    id: nextId('cat'),
    name,
    alias,
    color: input.color?.trim() || '--cat-1',
    position: input.position ?? maxPos + 1,
    is_system: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: 'browser-device',
  };
  memoryCategoriesStore.set(record.id, record);
  saveBrowserStoreToLocalStorage();
  return { ...record };
}

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<CategoryRecord> {
  if (isTauriRuntime()) {
    return invoke<CategoryRecord>('update_category', { input });
  }
  const existing = memoryCategoriesStore.get(input.id);
  if (!existing || existing.deleted_at !== null) {
    throw new Error(`Catégorie introuvable : ${input.id}`);
  }
  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) {
    throw new Error('Le nom de la catégorie ne peut pas être vide.');
  }
  const updated: CategoryRecord = {
    ...existing,
    name: nextName,
    alias: input.alias?.trim().toLowerCase() || existing.alias,
    color: input.color?.trim() || existing.color,
    position: input.position ?? existing.position,
    updated_at: new Date().toISOString(),
  };
  memoryCategoriesStore.set(updated.id, updated);
  saveBrowserStoreToLocalStorage();
  return { ...updated };
}

export async function deleteCategory(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('delete_category', { id });
    return;
  }
  const existing = memoryCategoriesStore.get(id);
  if (!existing) {
    throw new Error(`Catégorie introuvable : ${id}`);
  }
  if (existing.is_system || existing.id === 'cat-inbox') {
    throw new Error('Impossible de supprimer la catégorie système Inbox [TSK-3].');
  }
  const now = new Date().toISOString();
  memoryCategoriesStore.set(id, {
    ...existing,
    deleted_at: now,
    updated_at: now,
  });

  // Réassigner les tâches actives de cette catégorie vers Inbox [TSK-3]
  for (const [taskId, task] of memoryTasksStore.entries()) {
    if (task.category_id === id && task.deleted_at === null) {
      memoryTasksStore.set(taskId, {
        ...task,
        category_id: 'cat-inbox',
        updated_at: now,
      });
    }
  }
  saveBrowserStoreToLocalStorage();
}

// ============================================================================
// Tasks API [TSK-1, TSK-2, TSK-4, TSK-5]
// ============================================================================

export async function listTasks(): Promise<TaskRecord[]> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord[]>('list_tasks');
  }
  return Array.from(memoryTasksStore.values())
    .filter((task) => task.deleted_at === null)
    .sort((a, b) => {
      if (a.due_date === null && b.due_date !== null) return 1;
      if (a.due_date !== null && b.due_date === null) return -1;
      if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.created_at.localeCompare(b.created_at);
    })
    .map((t) => ({ ...t }));
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord>('create_task', { input });
  }
  const title = input.title.trim();
  if (!title) {
    throw new Error('Le titre de la tâche est obligatoire [TSK-1].');
  }
  const requestedCategory = input.category_id?.trim() || 'cat-inbox';
  const catRecord = memoryCategoriesStore.get(requestedCategory);
  const categoryId =
    catRecord && catRecord.deleted_at === null ? catRecord.id : 'cat-inbox';

  const status: TaskStatus = input.status ?? 'todo';
  const priority = Math.max(0, Math.min(3, input.priority ?? 0));
  const now = new Date().toISOString();

  const record: TaskRecord = {
    id: nextId('task'),
    title,
    notes: input.notes ?? '',
    category_id: categoryId,
    status,
    priority,
    due_date: input.due_date?.trim() ? input.due_date.trim() : null,
    has_due_time: Boolean(input.has_due_time),
    estimated_minutes:
      input.estimated_minutes && input.estimated_minutes > 0
        ? input.estimated_minutes
        : null,
    completed_at: status === 'done' ? now : null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: 'browser-device',
  };
  memoryTasksStore.set(record.id, record);
  saveBrowserStoreToLocalStorage();
  return { ...record };
}

export async function updateTask(input: UpdateTaskInput): Promise<TaskRecord> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord>('update_task', { input });
  }
  const existing = memoryTasksStore.get(input.id);
  if (!existing) {
    throw new Error(`Tâche introuvable : ${input.id}`);
  }
  const nextTitle =
    input.title !== undefined ? input.title.trim() : existing.title;
  if (!nextTitle) {
    throw new Error('Le titre de la tâche ne peut pas être vide [TSK-1].');
  }

  let nextCategoryId = existing.category_id;
  if (input.category_id !== undefined) {
    const cat = memoryCategoriesStore.get(input.category_id);
    nextCategoryId = cat && cat.deleted_at === null ? cat.id : 'cat-inbox';
  }

  const nextStatus: TaskStatus = input.status ?? existing.status;
  const nextPriority =
    input.priority !== undefined
      ? Math.max(0, Math.min(3, input.priority))
      : existing.priority;

  let nextDueDate = existing.due_date;
  if (input.clear_due_date) {
    nextDueDate = null;
  } else if (input.due_date !== undefined) {
    nextDueDate = input.due_date?.trim() ? input.due_date.trim() : null;
  }

  let nextEstimated = existing.estimated_minutes;
  if (input.clear_estimated_minutes) {
    nextEstimated = null;
  } else if (input.estimated_minutes !== undefined) {
    nextEstimated =
      input.estimated_minutes && input.estimated_minutes > 0
        ? input.estimated_minutes
        : null;
  }

  const now = new Date().toISOString();
  const nextCompletedAt =
    nextStatus === 'done' ? existing.completed_at ?? now : null;

  const updated: TaskRecord = {
    ...existing,
    title: nextTitle,
    notes: input.notes ?? existing.notes,
    category_id: nextCategoryId,
    status: nextStatus,
    priority: nextPriority,
    due_date: nextDueDate,
    has_due_time: input.has_due_time ?? existing.has_due_time,
    estimated_minutes: nextEstimated,
    completed_at: nextCompletedAt,
    updated_at: now,
  };
  memoryTasksStore.set(updated.id, updated);

  // Synchroniser l'issue dans le Focus [FOC-2]
  for (const [focusId, focusItem] of memoryFocusStore.entries()) {
    if (focusItem.task_id === updated.id && focusItem.deleted_at === null) {
      memoryFocusStore.set(focusId, {
        ...focusItem,
        outcome: nextStatus === 'done' ? 'completed' : null,
        updated_at: now,
      });
    }
  }

  saveBrowserStoreToLocalStorage();
  return { ...updated };
}

export async function completeTask(
  id: string,
  completed = true,
): Promise<TaskRecord> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord>('complete_task', { id, completed });
  }
  return updateTask({
    id,
    status: completed ? 'done' : 'todo',
  });
}

export async function deleteTask(id: string): Promise<TaskRecord> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord>('delete_task', { id });
  }
  const existing = memoryTasksStore.get(id);
  if (!existing) {
    throw new Error(`Tâche introuvable : ${id}`);
  }
  const now = new Date().toISOString();
  const deleted: TaskRecord = {
    ...existing,
    deleted_at: now,
    updated_at: now,
  };
  memoryTasksStore.set(id, deleted);

  const affectedDays = new Set<string>();
  for (const [focusId, item] of memoryFocusStore.entries()) {
    if (item.task_id === id && item.deleted_at === null) {
      affectedDays.add(item.focus_day);
      memoryFocusStore.set(focusId, {
        ...item,
        deleted_at: now,
        updated_at: now,
      });
    }
  }
  for (const day of affectedDays) {
    compactMemoryFocusPositions(day);
  }
  saveBrowserStoreToLocalStorage();
  return { ...deleted };
}

export async function restoreTask(id: string): Promise<TaskRecord> {
  if (isTauriRuntime()) {
    return invoke<TaskRecord>('restore_task', { id });
  }
  const existing = memoryTasksStore.get(id);
  if (!existing) {
    throw new Error(`Tâche introuvable : ${id}`);
  }
  const now = new Date().toISOString();
  const restored: TaskRecord = {
    ...existing,
    deleted_at: null,
    updated_at: now,
  };
  memoryTasksStore.set(id, restored);
  saveBrowserStoreToLocalStorage();
  return { ...restored };
}

// ============================================================================
// Focus 5 API [FOC-1, FOC-2]
// ============================================================================

function compactMemoryFocusPositions(focusDay: string): void {
  const active = Array.from(memoryFocusStore.values())
    .filter((f) => f.focus_day === focusDay && f.deleted_at === null)
    .sort((a, b) => a.position - b.position);
  const now = new Date().toISOString();
  active.forEach((item, idx) => {
    const desired = idx + 1;
    if (item.position !== desired) {
      memoryFocusStore.set(item.id, {
        ...item,
        position: desired,
        updated_at: now,
      });
    }
  });
}

export async function listFocusItems(
  focusDay: string,
): Promise<FocusItemRecord[]> {
  if (isTauriRuntime()) {
    return invoke<FocusItemRecord[]>('list_focus_items', { focusDay });
  }
  return Array.from(memoryFocusStore.values())
    .filter((item) => item.focus_day === focusDay && item.deleted_at === null)
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ ...f }));
}

export async function addFocusItem(
  focusDay: string,
  taskId: string,
): Promise<FocusItemRecord> {
  if (isTauriRuntime()) {
    return invoke<FocusItemRecord>('add_focus_item', { focusDay, taskId });
  }
  const task = memoryTasksStore.get(taskId);
  if (!task || task.deleted_at !== null) {
    throw new Error(`Tâche introuvable ou supprimée : ${taskId}`);
  }
  const current = await listFocusItems(focusDay);
  if (current.some((item) => item.task_id === taskId)) {
    throw new Error('Cette tâche figure déjà dans le Focus du jour [FOC-1].');
  }
  if (current.length >= 5) {
    throw new Error(
      'Limite atteinte : Le Focus du jour ne peut pas contenir plus de 5 tâches [FOC-1].',
    );
  }
  const now = new Date().toISOString();
  const record: FocusItemRecord = {
    id: nextId('focus'),
    focus_day: focusDay,
    task_id: taskId,
    position: current.length + 1,
    outcome: task.status === 'done' ? 'completed' : null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: 'browser-device',
  };
  memoryFocusStore.set(record.id, record);
  saveBrowserStoreToLocalStorage();
  return { ...record };
}

export async function removeFocusItem(
  focusDay: string,
  taskId: string,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('remove_focus_item', { focusDay, taskId });
    return;
  }
  const target = Array.from(memoryFocusStore.values()).find(
    (item) =>
      item.focus_day === focusDay &&
      item.task_id === taskId &&
      item.deleted_at === null,
  );
  if (!target) {
    throw new Error(`La tâche ${taskId} n'est pas dans le Focus du ${focusDay}`);
  }
  const now = new Date().toISOString();
  memoryFocusStore.set(target.id, {
    ...target,
    deleted_at: now,
    updated_at: now,
  });
  compactMemoryFocusPositions(focusDay);
  saveBrowserStoreToLocalStorage();
}

export async function reorderFocusItems(
  focusDay: string,
  orderedTaskIds: string[],
): Promise<FocusItemRecord[]> {
  if (isTauriRuntime()) {
    return invoke<FocusItemRecord[]>('reorder_focus_items', {
      focusDay,
      orderedTaskIds,
    });
  }
  const current = await listFocusItems(focusDay);
  if (current.length === 0) {
    return [];
  }
  const now = new Date().toISOString();
  let pos = 1;
  for (const tid of orderedTaskIds) {
    const found = current.find((item) => item.task_id === tid);
    if (found && pos <= 5) {
      memoryFocusStore.set(found.id, {
        ...found,
        position: pos,
        updated_at: now,
      });
      pos += 1;
    }
  }
  for (const item of current) {
    if (!orderedTaskIds.includes(item.task_id) && pos <= 5) {
      memoryFocusStore.set(item.id, {
        ...item,
        position: pos,
        updated_at: now,
      });
      pos += 1;
    }
  }
  saveBrowserStoreToLocalStorage();
  return listFocusItems(focusDay);
}

/**
 * FOC-3 : Liste les éléments Focus non terminés des jours strictement antérieurs à `beforeFocusDay`
 * (`focus_day < beforeFocusDay`), dont l'issue n'est ni `'completed'` ni `'abandoned'`,
 * et dont la tâche associée est active et non terminée (`status !== 'done' && status !== 'cancelled'`).
 */
export async function listUncompletedPastFocusItems(
  beforeFocusDay: string,
): Promise<FocusItemRecord[]> {
  if (isTauriRuntime()) {
    return invoke<FocusItemRecord[]>('list_uncompleted_past_focus_items', {
      beforeFocusDay,
      before_focus_day: beforeFocusDay,
    });
  }
  return Array.from(memoryFocusStore.values())
    .filter((item) => {
      if (item.deleted_at !== null || item.focus_day >= beforeFocusDay) {
        return false;
      }
      if (item.outcome === 'completed' || item.outcome === 'abandoned') {
        return false;
      }
      const task = memoryTasksStore.get(item.task_id);
      if (
        !task ||
        task.deleted_at !== null ||
        task.status === 'done' ||
        task.status === 'cancelled'
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.focus_day !== b.focus_day) {
        return b.focus_day.localeCompare(a.focus_day);
      }
      return a.position - b.position;
    })
    .map((f) => ({ ...f }));
}

// ============================================================================
// Sauvegardes automatiques, Rotation 7j/4sem & Export JSON [BKP-1, BKP-2, BKP-3]
// ============================================================================

export const EXPORT_FORMAT_V1 = 'productivity-dashboard-backup-v1';
const MAX_DAILY_BACKUPS = 7;
const MAX_WEEKLY_BACKUPS = 4;

function getIsoWeekLabel(dateObj: Date): string {
  const utc = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
    ),
  );
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function rotateMemoryBackups(): RotationReport {
  const dailies = memoryBackupsStore
    .filter((b) => b.kind === 'daily')
    .sort((a, b) => b.filename.localeCompare(a.filename));
  const weeklies = memoryBackupsStore
    .filter((b) => b.kind === 'weekly')
    .sort((a, b) => b.filename.localeCompare(a.filename));
  const others = memoryBackupsStore.filter(
    (b) => b.kind !== 'daily' && b.kind !== 'weekly',
  );

  const keptDailies = dailies.slice(0, MAX_DAILY_BACKUPS);
  const deletedDailies = dailies.slice(MAX_DAILY_BACKUPS);

  const keptWeeklies = weeklies.slice(0, MAX_WEEKLY_BACKUPS);
  const deletedWeeklies = weeklies.slice(MAX_WEEKLY_BACKUPS);

  memoryBackupsStore = [...keptDailies, ...keptWeeklies, ...others].sort(
    (a, b) => b.filename.localeCompare(a.filename),
  );

  return {
    daily_kept: keptDailies.length,
    daily_deleted: deletedDailies.length,
    weekly_kept: keptWeeklies.length,
    weekly_deleted: deletedWeeklies.length,
    deleted_files: [
      ...deletedDailies.map((d) => d.filename),
      ...deletedWeeklies.map((w) => w.filename),
    ],
  };
}

export async function triggerBackup(force = true): Promise<BackupReport> {
  if (isTauriRuntime()) {
    return invoke<BackupReport>('trigger_backup', { force });
  }
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekStr = getIsoWeekLabel(now);
  const configuredDir = await getSettingValue<string>(
    'backup_dir',
    DEFAULT_SETTINGS.backup_dir,
  );
  const backupDir = configuredDir.trim() || 'memory://backups';

  const dailyFilename = `daily-${dateStr}.db`;
  const weeklyFilename = `weekly-${weekStr}.db`;
  const dailyPath = `${backupDir}/${dailyFilename}`;
  const weeklyPath = `${backupDir}/${weeklyFilename}`;

  const lastAutoDate = await getSettingValue<string | null>(
    'last_auto_backup_date',
    null,
  );
  const hasDaily = memoryBackupsStore.some((b) => b.filename === dailyFilename);
  const hasWeekly = memoryBackupsStore.some(
    (b) => b.filename === weeklyFilename,
  );

  if (!force && lastAutoDate === dateStr && hasDaily && hasWeekly) {
    const rotation = rotateMemoryBackups();
    return {
      performed: false,
      backup_dir: backupDir,
      daily_backup_path: dailyPath,
      weekly_backup_path: weeklyPath,
      backup_date: dateStr,
      rotation,
    };
  }

  await setSettingValue('last_auto_backup_date', dateStr);
  const nowIso = now.toISOString();
  const approxSize = 4096 + memoryTasksStore.size * 256;

  memoryBackupsStore = memoryBackupsStore.filter(
    (b) => b.filename !== dailyFilename && b.filename !== weeklyFilename,
  );
  memoryBackupsStore.push(
    {
      filename: dailyFilename,
      path: dailyPath,
      kind: 'daily',
      size_bytes: approxSize,
      modified_at: nowIso,
    },
    {
      filename: weeklyFilename,
      path: weeklyPath,
      kind: 'weekly',
      size_bytes: approxSize,
      modified_at: nowIso,
    },
  );

  const rotation = rotateMemoryBackups();
  saveBrowserStoreToLocalStorage();

  return {
    performed: true,
    backup_dir: backupDir,
    daily_backup_path: dailyPath,
    weekly_backup_path: weeklyPath,
    backup_date: dateStr,
    rotation,
  };
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  if (isTauriRuntime()) {
    return invoke<BackupFileInfo[]>('list_backups');
  }
  return [...memoryBackupsStore].sort((a, b) =>
    b.filename.localeCompare(a.filename),
  );
}

export async function setBackupDir(backupDir: string): Promise<string> {
  const trimmed = backupDir.trim();
  if (isTauriRuntime()) {
    const rec = await invoke<SettingRecord>('set_backup_dir', {
      backupDir: trimmed,
      backup_dir: trimmed,
    });
    try {
      return JSON.parse(rec.value_json) as string;
    } catch {
      return trimmed;
    }
  }
  await setSettingValue('backup_dir', trimmed);
  return trimmed;
}

// ============================================================================
// Sources ICS, Trousseau Système & Cache Local d'Événements [AGD-1, AGD-5, PRV-3]
// ============================================================================

export function buildIcsKeychainRef(sourceId: string): string {
  return `${KEYCHAIN_ICS_URL_PREFIX}${sourceId.trim()}`;
}

export function normalizeAndValidateIcsUrl(rawLocation: string): string {
  const trimmed = (rawLocation || '').trim();
  if (!trimmed) {
    throw new Error("L'URL de la source ICS est obligatoire [AGD-1].");
  }
  let normalized = trimmed;
  if (/^webcal:\/\//i.test(normalized)) {
    normalized = `https://${normalized.slice('webcal://'.length)}`;
  } else if (/^webcals:\/\//i.test(normalized)) {
    normalized = `https://${normalized.slice('webcals://'.length)}`;
  }

  let remainder = '';
  if (/^https:\/\//i.test(normalized)) {
    remainder = normalized.slice('https://'.length);
  } else if (/^http:\/\//i.test(normalized)) {
    remainder = normalized.slice('http://'.length);
  } else {
    throw new Error(
      `Schéma d'URL ICS invalide pour '${trimmed}'. Utilisez http://, https:// ou webcal:// [AGD-1].`,
    );
  }

  const hostPart = remainder.split('/')[0] ?? '';
  if (!hostPart.trim()) {
    throw new Error(
      "L'URL de la source ICS doit comporter un hôte valide [AGD-1].",
    );
  }

  return normalized;
}

export function getBrowserKeychainSecret(keychainRef: string): string | null {
  return memoryKeychainStore.get(keychainRef.trim()) ?? null;
}

export async function listCalendarSources(): Promise<CalendarSourceRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CalendarSourceRecord[]>('list_calendar_sources');
  }
  return Array.from(memoryCalendarSourcesStore.values())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s) => ({ ...s }));
}

export async function createCalendarSource(
  input: CreateCalendarSourceInput,
): Promise<CalendarSourceRecord> {
  if (isTauriRuntime()) {
    return invoke<CalendarSourceRecord>('create_calendar_source', {
      input: {
        ...input,
        location: input.location ?? '',
      },
    });
  }

  const name = (input.name ?? '').trim();
  if (!name) {
    throw new Error('Le nom de la source ICS est obligatoire [AGD-1].');
  }

  const sourceType = (input.source_type ?? '').trim().toLowerCase();
  if (sourceType !== 'file' && sourceType !== 'url') {
    throw new Error(
      `Type de source ICS invalide '${input.source_type}' (attendu : 'file' ou 'url') [AGD-1].`,
    );
  }

  const refreshInterval = input.refresh_interval_minutes ?? 30;
  if (refreshInterval < 5) {
    throw new Error(
      "L'intervalle de rafraîchissement ICS doit être d'au moins 5 minutes [AGD-1].",
    );
  }

  const id = nextId('ics-src');
  let locationOrKeychainRef = '';

  if (sourceType === 'url') {
    const normalizedUrl = normalizeAndValidateIcsUrl(input.location ?? '');
    locationOrKeychainRef = buildIcsKeychainRef(id);
    memoryKeychainStore.set(locationOrKeychainRef, normalizedUrl);
    saveBrowserKeychainToStorage();
  } else {
    const rawContent = input.raw_ics_content?.trim();
    const rawLoc = (input.location ?? '').trim();
    if (/^(https?|webcals?):\/\//i.test(rawLoc)) {
      throw new Error(
        "Une source ICS de type 'file' ne peut pas stocker une URL réseau [PRV-3].",
      );
    }
    if (rawContent) {
      locationOrKeychainRef = `/ics_sources/${id}.ics`;
      memoryIcsFilesStore.set(locationOrKeychainRef, input.raw_ics_content!);
    } else if (rawLoc) {
      locationOrKeychainRef = rawLoc;
    } else {
      throw new Error('Le chemin du fichier ICS est obligatoire [AGD-1].');
    }
  }

  const now = new Date().toISOString();
  const record: CalendarSourceRecord = {
    id,
    name,
    source_type: sourceType,
    location_or_keychain_ref: locationOrKeychainRef,
    refresh_interval_minutes: refreshInterval,
    last_synced_at: null,
    last_error: null,
    created_at: now,
    updated_at: now,
  };

  memoryCalendarSourcesStore.set(record.id, record);
  saveBrowserStoreToLocalStorage();
  return { ...record };
}

export async function updateCalendarSource(
  input: UpdateCalendarSourceInput,
): Promise<CalendarSourceRecord> {
  if (isTauriRuntime()) {
    return invoke<CalendarSourceRecord>('update_calendar_source', { input });
  }

  const existing = memoryCalendarSourcesStore.get(input.id);
  if (!existing) {
    throw new Error(`Source ICS introuvable : ${input.id}`);
  }

  const nextName =
    input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) {
    throw new Error('Le nom de la source ICS ne peut pas être vide [AGD-1].');
  }

  const nextInterval =
    input.refresh_interval_minutes ?? existing.refresh_interval_minutes;
  if (nextInterval < 5) {
    throw new Error(
      "L'intervalle de rafraîchissement ICS doit être d'au moins 5 minutes [AGD-1].",
    );
  }

  let nextLocationOrKeychainRef = existing.location_or_keychain_ref;
  if (existing.source_type === 'url') {
    nextLocationOrKeychainRef = buildIcsKeychainRef(existing.id);
    if (input.location !== undefined) {
      const normalizedUrl = normalizeAndValidateIcsUrl(input.location);
      memoryKeychainStore.set(nextLocationOrKeychainRef, normalizedUrl);
      saveBrowserKeychainToStorage();
    }
  } else if (input.raw_ics_content && input.raw_ics_content.trim()) {
    nextLocationOrKeychainRef = `/ics_sources/${existing.id}.ics`;
    memoryIcsFilesStore.set(nextLocationOrKeychainRef, input.raw_ics_content);
  } else if (input.location !== undefined) {
    const trimmedLoc = input.location.trim();
    if (!trimmedLoc) {
      throw new Error(
        'Le chemin du fichier ICS ne peut pas être vide [AGD-1].',
      );
    }
    if (/^(https?|webcals?):\/\//i.test(trimmedLoc)) {
      throw new Error(
        "Une source ICS de type 'file' ne peut pas stocker une URL réseau [PRV-3].",
      );
    }
    nextLocationOrKeychainRef = trimmedLoc;
  }

  const updated: CalendarSourceRecord = {
    ...existing,
    name: nextName,
    location_or_keychain_ref: nextLocationOrKeychainRef,
    refresh_interval_minutes: nextInterval,
    updated_at: new Date().toISOString(),
  };

  memoryCalendarSourcesStore.set(updated.id, updated);
  saveBrowserStoreToLocalStorage();
  return { ...updated };
}

export async function deleteCalendarSource(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('delete_calendar_source', { id });
    return;
  }

  const existing = memoryCalendarSourcesStore.get(id);
  if (!existing) {
    throw new Error(`Source ICS introuvable : ${id}`);
  }

  const canonicalRef = buildIcsKeychainRef(existing.id);
  memoryKeychainStore.delete(canonicalRef);
  if (existing.location_or_keychain_ref.startsWith(KEYCHAIN_ICS_URL_PREFIX)) {
    memoryKeychainStore.delete(existing.location_or_keychain_ref);
  }
  saveBrowserKeychainToStorage();

  memoryIcsFilesStore.delete(existing.location_or_keychain_ref);
  memoryCalendarSourcesStore.delete(id);

  // ON DELETE CASCADE : supprimer les événements rattachés à cette source
  for (const [evtId, evt] of memoryCalendarEventsStore.entries()) {
    if (evt.source_id === id) {
      memoryCalendarEventsStore.delete(evtId);
    }
  }

  saveBrowserStoreToLocalStorage();
}

export async function recordCalendarSourceError(
  sourceId: string,
  errorMessage: string,
): Promise<CalendarSourceRecord> {
  if (isTauriRuntime()) {
    return invoke<CalendarSourceRecord>('record_calendar_source_error', {
      sourceId,
      source_id: sourceId,
      errorMessage,
      error_message: errorMessage,
    });
  }

  const existing = memoryCalendarSourcesStore.get(sourceId);
  if (!existing) {
    throw new Error(`Source ICS introuvable : ${sourceId}`);
  }

  const updated: CalendarSourceRecord = {
    ...existing,
    last_error: errorMessage.trim(),
    updated_at: new Date().toISOString(),
  };
  memoryCalendarSourcesStore.set(updated.id, updated);
  saveBrowserStoreToLocalStorage();
  return { ...updated };
}

export async function fetchCalendarSourceIcs(id: string): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>('fetch_calendar_source_ics', { id });
  }

  const source = memoryCalendarSourcesStore.get(id);
  if (!source) {
    throw new Error(`Source ICS introuvable : ${id}`);
  }

  try {
    if (source.source_type === 'file') {
      const content = memoryIcsFilesStore.get(source.location_or_keychain_ref);
      if (!content) {
        throw new Error(
          `Impossible de lire le fichier ICS '${source.location_or_keychain_ref}'.`,
        );
      }
      return content;
    }

    const secretUrl = memoryKeychainStore.get(source.location_or_keychain_ref);
    if (!secretUrl) {
      throw new Error(
        'URL ICS introuvable dans le trousseau système [PRV-3].',
      );
    }

    if (typeof fetch !== 'function') {
      throw new Error("API fetch indisponible dans cet environnement.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(secretUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Statut HTTP d'erreur ${response.status}`);
      }
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Le flux ICS téléchargé est vide.');
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erreur de lecture du flux ICS';
    await recordCalendarSourceError(source.id, message);
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function saveCalendarEventsForSource(
  sourceId: string,
  events: CalendarEventInput[],
): Promise<CalendarEventRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CalendarEventRecord[]>('save_calendar_events_for_source', {
      sourceId,
      source_id: sourceId,
      events,
    });
  }

  const existingSource = memoryCalendarSourcesStore.get(sourceId);
  if (!existingSource) {
    throw new Error(`Source ICS introuvable : ${sourceId}`);
  }

  // Transaction atomique en mémoire : valider d'abord tous les événements avant de remplacer
  const prepared: CalendarEventRecord[] = events.map((item) => {
    const icsUid = (item.ics_uid ?? '').trim();
    if (!icsUid) {
      throw new Error(
        "L'identifiant UID ICS de l'événement est obligatoire.",
      );
    }
    const startAt = (item.start_at ?? '').trim();
    const endAt = (item.end_at ?? '').trim();
    if (!startAt || !endAt) {
      throw new Error(
        "Les dates de début et de fin de l'événement sont obligatoires.",
      );
    }
    const title = (item.title ?? '').trim() || '(Sans titre)';
    const exdatesJson =
      item.exdates_json && item.exdates_json.trim()
        ? item.exdates_json.trim()
        : item.exdates
          ? JSON.stringify(item.exdates)
          : '[]';

    return {
      id: item.id?.trim() ? item.id.trim() : nextId('evt'),
      source_id: existingSource.id,
      ics_uid: icsUid,
      title,
      start_at: startAt,
      end_at: endAt,
      is_all_day: Boolean(item.is_all_day),
      location: item.location ?? '',
      notes: item.notes ?? '',
      rrule: item.rrule?.trim() ? item.rrule.trim() : null,
      exdates_json: exdatesJson,
    };
  });

  for (const [evtId, evt] of memoryCalendarEventsStore.entries()) {
    if (evt.source_id === existingSource.id) {
      memoryCalendarEventsStore.delete(evtId);
    }
  }

  for (const record of prepared) {
    memoryCalendarEventsStore.set(record.id, record);
  }

  const now = new Date().toISOString();
  memoryCalendarSourcesStore.set(existingSource.id, {
    ...existingSource,
    last_synced_at: now,
    last_error: null,
    updated_at: now,
  });

  saveBrowserStoreToLocalStorage();
  return listCalendarEvents(existingSource.id);
}

export async function listCalendarEvents(
  sourceId?: string,
): Promise<CalendarEventRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CalendarEventRecord[]>('list_calendar_events', {
      sourceId: sourceId ?? null,
      source_id: sourceId ?? null,
    });
  }

  const trimmedSourceId = sourceId?.trim();
  return Array.from(memoryCalendarEventsStore.values())
    .filter((evt) => !trimmedSourceId || evt.source_id === trimmedSourceId)
    .sort((a, b) => {
      if (a.start_at !== b.start_at) {
        return a.start_at.localeCompare(b.start_at);
      }
      return a.id.localeCompare(b.id);
    })
    .map((e) => ({ ...e }));
}

export async function exportFullJson(destPath?: string): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>('export_full_json', {
      destPath,
      dest_path: destPath,
    });
  }
  const payload: FullDatabaseExport = {
    format: EXPORT_FORMAT_V1,
    schema_version: 4,
    exported_at: new Date().toISOString(),
    categories: Array.from(memoryCategoriesStore.values()).sort(
      (a, b) => a.position - b.position,
    ),
    tasks: Array.from(memoryTasksStore.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
    focus_items: Array.from(memoryFocusStore.values()).sort((a, b) => {
      if (a.focus_day !== b.focus_day) {
        return a.focus_day.localeCompare(b.focus_day);
      }
      return a.position - b.position;
    }),
    calendar_sources: Array.from(memoryCalendarSourcesStore.values()).sort(
      (a, b) => a.created_at.localeCompare(b.created_at),
    ),
    calendar_events: Array.from(memoryCalendarEventsStore.values()).sort(
      (a, b) => a.start_at.localeCompare(b.start_at),
    ),
    launcher_items: [],
    commands: [],
    settings: Array.from(memorySettingsStore.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
  };
  return JSON.stringify(payload, null, 2);
}

// ============================================================================
// Demo Data Seeding (hors production, fidèle aux maquettes)
// ============================================================================

export async function seedDemoData(
  referenceDate = '2026-11-02',
): Promise<void> {
  resetMemoryFallbackStore();
  applyDemoSeedSync(false, referenceDate);
  saveBrowserStoreToLocalStorage();
}

// ============================================================================
// Health / Status API
// ============================================================================

export async function getDbStatus(): Promise<DbStatus> {
  if (isTauriRuntime()) {
    return invoke<DbStatus>('get_db_status');
  }
  return {
    db_path: 'memory://dashboard.db',
    schema_version: 4,
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
