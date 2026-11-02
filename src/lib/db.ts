import { invoke } from '@tauri-apps/api/core';

export type ThemeMode = 'light' | 'dark' | 'system';

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
  active_palette: string;
  custom_palettes: ColorPalette[];
  user_name: string;
  language: 'fr' | 'en';
  briefing_mode: 'first_open' | 'fixed_time';
  briefing_time: string;
  last_briefing_date: string | null;
  global_capture_shortcut: string;
  [key: string]: unknown;
}

const BROWSER_STORAGE_KEY = 'focus_browser_db_v2';

const DEFAULT_SETTINGS: DefaultSettingsMap = {
  theme: 'system',
  active_palette: 'coolors-classic',
  custom_palettes: [],
  user_name: '',
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
}

let memorySettingsStore: Map<string, SettingRecord> = new Map();
let memoryCategoriesStore: Map<string, CategoryRecord> = new Map();
let memoryTasksStore: Map<string, TaskRecord> = new Map();
let memoryFocusStore: Map<string, FocusItemRecord> = new Map();
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
    return true;
  } catch {
    return false;
  }
}

function initializeMemoryStores(): void {
  if (!loadBrowserStoreFromLocalStorage()) {
    memorySettingsStore = createInitialSettingsMap();
    memoryCategoriesStore = createInitialCategoriesMap();
    memoryTasksStore = new Map();
    memoryFocusStore = new Map();
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
    } catch {
      // ignore
    }
  }
  memorySettingsStore = createInitialSettingsMap();
  memoryCategoriesStore = createInitialCategoriesMap();
  memoryTasksStore = new Map();
  memoryFocusStore = new Map();
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

// ============================================================================
// Demo Data Seeding (hors production, fidèle aux maquettes)
// ============================================================================

export async function seedDemoData(
  referenceDate = '2026-11-02',
): Promise<void> {
  resetMemoryFallbackStore();
  await setSettingValue('user_name', 'Selasi');

  // 8 tâches à faire et 2 tâches terminées fidèles à docs/ui-tasks-reference.png
  const t1 = await createTask({
    title: 'Réviser le chapitre de statistiques',
    notes: 'Chapitre 4',
    category_id: 'cat-ecole',
    priority: 3,
    due_date: referenceDate,
    estimated_minutes: 45,
    status: 'todo',
  });
  const t2 = await createTask({
    title: 'Finaliser les wireframes du portfolio',
    notes: "Page d'accueil",
    category_id: 'cat-projets',
    priority: 3,
    due_date: referenceDate,
    estimated_minutes: 60,
    status: 'todo',
  });
  await createTask({
    title: 'Faire une sortie de 5 km',
    notes: "Prendre l'air",
    category_id: 'cat-sport',
    priority: 2,
    due_date: referenceDate,
    estimated_minutes: 30,
    status: 'todo',
  });
  await createTask({
    title: 'Appeler le dentiste',
    notes: 'Prendre rendez-vous',
    category_id: 'cat-perso',
    priority: 1,
    due_date: referenceDate,
    estimated_minutes: 10,
    status: 'todo',
  });
  await createTask({
    title: 'Envoyer le dossier de candidature',
    notes: 'Relire la lettre et joindre le CV',
    category_id: 'cat-ecole',
    priority: 2,
    due_date: '2026-11-04',
    status: 'todo',
  });
  await createTask({
    title: 'Préparer la présentation du projet',
    notes: 'Rassembler les premières idées',
    category_id: 'cat-projets',
    priority: 2,
    due_date: '2026-11-05',
    status: 'todo',
  });
  await createTask({
    title: 'Réserver les billets pour le week-end',
    notes: 'Comparer les horaires de train',
    category_id: 'cat-perso',
    priority: 1,
    due_date: '2026-11-06',
    status: 'todo',
  });
  await createTask({
    title: 'Trier mes notes et idées',
    notes: 'Faire un peu de place dans mes idées',
    category_id: 'cat-inbox',
    priority: 0,
    due_date: null,
    status: 'todo',
  });

  // 2 tâches terminées (Terminées 2)
  await createTask({
    title: 'Installer l’environnement de travail',
    notes: 'Configuration initiale',
    category_id: 'cat-projets',
    priority: 1,
    due_date: referenceDate,
    status: 'done',
  });
  await createTask({
    title: 'Organiser les dossiers du semestre',
    notes: 'Cours et TD',
    category_id: 'cat-ecole',
    priority: 1,
    due_date: referenceDate,
    status: 'done',
  });

  // 2 premières tâches du jour épinglées au Focus (icône cible sur la maquette Tâches)
  await addFocusItem(referenceDate, t1.id);
  await addFocusItem(referenceDate, t2.id);
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
    schema_version: 2,
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
