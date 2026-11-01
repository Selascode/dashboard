-- ============================================================================
-- Migration 001 : Schéma Initial du MVP Dashboard de Productivité
-- Règles : Dates UTC ISO 8601, Suppression logique (deleted_at), Prêt pour Sync
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ----------------------------------------------------------------------------
-- 1. Table : categories (Entité synchronisable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID (ex: 'inbox' pour la catégorie système)
    name TEXT NOT NULL,
    alias TEXT NOT NULL,                        -- Jeton court sans accent (ex: 'ecole', 'eco')
    color TEXT NOT NULL,                        -- Code couleur hexadécimal ou token Tailwind
    position INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
    created_at TEXT NOT NULL,                   -- UTC ISO 8601
    updated_at TEXT NOT NULL,                   -- UTC ISO 8601
    deleted_at TEXT DEFAULT NULL,               -- Suppression logique
    device_id TEXT NOT NULL
);

-- Empêcher la suppression physique ou logique de la catégorie système Inbox [TSK-3]
CREATE TRIGGER IF NOT EXISTS trg_prevent_inbox_delete
BEFORE DELETE ON categories
FOR EACH ROW
WHEN OLD.is_system = 1
BEGIN
    SELECT RAISE(ABORT, 'Impossible de supprimer la catégorie système Inbox [TSK-3].');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_inbox_soft_delete
BEFORE UPDATE OF deleted_at ON categories
FOR EACH ROW
WHEN OLD.is_system = 1 AND NEW.deleted_at IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'Impossible de supprimer logiquement la catégorie système Inbox [TSK-3].');
END;

-- Insertion des 5 catégories par défaut au premier lancement [TSK-3]
INSERT OR IGNORE INTO categories (id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id)
VALUES
    ('cat-inbox',   'Inbox',   'inbox',   '#64748b', 0, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL, 'local-init'),
    ('cat-ecole',   'École',   'ecole',   '#3b82f6', 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL, 'local-init'),
    ('cat-sport',   'Sport',   'sport',   '#10b981', 2, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL, 'local-init'),
    ('cat-perso',   'Perso',   'perso',   '#f59e0b', 3, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL, 'local-init'),
    ('cat-projets', 'Projets', 'projets', '#8b5cf6', 4, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL, 'local-init');

-- ----------------------------------------------------------------------------
-- 2. Table : tasks (Entité synchronisable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID
    title TEXT NOT NULL CHECK (length(trim(title)) > 0), -- Seul champ obligatoire [TSK-1]
    notes TEXT NOT NULL DEFAULT '',
    category_id TEXT NOT NULL DEFAULT 'cat-inbox',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    due_date TEXT DEFAULT NULL,                 -- Date locale YYYY-MM-DD ou UTC ISO 8601 si has_due_time = 1
    has_due_time INTEGER NOT NULL DEFAULT 0 CHECK (has_due_time IN (0, 1)),
    estimated_minutes INTEGER DEFAULT NULL CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    completed_at TEXT DEFAULT NULL,             -- UTC ISO 8601
    created_at TEXT NOT NULL,                   -- UTC ISO 8601
    updated_at TEXT NOT NULL,                   -- UTC ISO 8601
    deleted_at TEXT DEFAULT NULL,               -- Suppression logique
    device_id TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET DEFAULT
);

-- Si une catégorie est supprimée logiquement, renvoyer ses tâches actives dans Inbox [TSK-3]
CREATE TRIGGER IF NOT EXISTS trg_reassign_tasks_to_inbox_on_category_soft_delete
AFTER UPDATE OF deleted_at ON categories
FOR EACH ROW
WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND OLD.is_system = 0
BEGIN
    UPDATE tasks
    SET category_id = 'cat-inbox',
        updated_at = NEW.updated_at
    WHERE category_id = OLD.id AND deleted_at IS NULL;
END;

-- ----------------------------------------------------------------------------
-- 3. Table : focus_items (Entité synchronisable — Focus 5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS focus_items (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID
    focus_day TEXT NOT NULL,                    -- Date locale du jour : YYYY-MM-DD
    task_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
    outcome TEXT DEFAULT NULL CHECK (outcome IS NULL OR outcome IN ('completed', 'carried_over', 'abandoned')),
    created_at TEXT NOT NULL,                   -- UTC ISO 8601
    updated_at TEXT NOT NULL,                   -- UTC ISO 8601
    deleted_at TEXT DEFAULT NULL,               -- Suppression logique
    device_id TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Une tâche ne peut apparaître qu'une seule fois par jour dans le Focus actif [Section 6]
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_unique_task_per_day
ON focus_items (focus_day, task_id)
WHERE deleted_at IS NULL;

-- Contrainte stricte en base : Maximum 5 éléments actifs dans le Focus par jour [FOC-1]
CREATE TRIGGER IF NOT EXISTS trg_enforce_focus_5_limit
BEFORE INSERT ON focus_items
FOR EACH ROW
WHEN NEW.deleted_at IS NULL AND (
    SELECT COUNT(*)
    FROM focus_items
    WHERE focus_day = NEW.focus_day
      AND deleted_at IS NULL
) >= 5
BEGIN
    SELECT RAISE(ABORT, 'Limite atteinte : Le Focus du jour ne peut pas contenir plus de 5 tâches [FOC-1].');
END;

-- ----------------------------------------------------------------------------
-- 4. Table : calendar_sources (Sources ICS locales ou URL via Trousseau OS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_sources (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url')),
    -- Pour 'file' : chemin local. Pour 'url' : identifiant de clé dans le trousseau OS [PRV-3]
    location_or_keychain_ref TEXT NOT NULL,
    refresh_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (refresh_interval_minutes >= 5),
    last_synced_at TEXT DEFAULT NULL,           -- UTC ISO 8601
    last_error TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 5. Table : calendar_events (Cache local en lecture seule pour hors-ligne [AGD-5])
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID interne
    source_id TEXT NOT NULL,
    ics_uid TEXT NOT NULL,                      -- UID de l'événement dans le flux ICS
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,                     -- UTC ISO 8601 ou YYYY-MM-DD si is_all_day = 1
    end_at TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0 CHECK (is_all_day IN (0, 1)),
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    rrule TEXT DEFAULT NULL,                    -- Règle de récurrence brute (RRULE) [AGD-4]
    exdates_json TEXT NOT NULL DEFAULT '[]',    -- Exceptions de récurrence (JSON array)
    FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. Table : launcher_items (Outils connectés — Entité synchronisable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS launcher_items (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID
    label TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('url', 'uri_scheme', 'folder', 'file', 'application')),
    target TEXT NOT NULL,                       -- Cible validée (aucune commande shell [LNC-4, PRV-4])
    icon TEXT NOT NULL DEFAULT 'link',
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    group_name TEXT NOT NULL DEFAULT 'Général',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,                   -- UTC ISO 8601
    updated_at TEXT NOT NULL,                   -- UTC ISO 8601
    deleted_at TEXT DEFAULT NULL,               -- Suppression logique
    device_id TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. Table : commands (Commandes personnalisées, alias et modèles — Synchronisable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY NOT NULL,               -- UUID ou identifiant de commande surchargée
    label TEXT NOT NULL,
    alias TEXT DEFAULT NULL,                    -- Ex: 'obs' pour ouvrir Obsidian [CMD-2]
    action_type TEXT NOT NULL CHECK (action_type IN ('builtin_override', 'launcher_alias', 'capture_template')),
    action_target TEXT NOT NULL,                -- ID de la commande ou de l'élément du lanceur
    template_text TEXT DEFAULT NULL,            -- Ex: 'Séance de sport #sport @auj ~1h' [CMD-3]
    shortcut TEXT DEFAULT NULL,                 -- Ex: 'Ctrl+Shift+Space' [CMD-1]
    created_at TEXT NOT NULL,                   -- UTC ISO 8601
    updated_at TEXT NOT NULL,                   -- UTC ISO 8601
    deleted_at TEXT DEFAULT NULL,               -- Suppression logique
    device_id TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. Table : settings (Paramètres locaux et préférences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,                   -- Valeur sérialisée en JSON
    updated_at TEXT NOT NULL                    -- UTC ISO 8601
);

-- Valeurs par défaut zéro friction dès le premier lancement [Section 1 & Section 6]
INSERT OR IGNORE INTO settings (key, value_json, updated_at)
VALUES
    ('theme', '"system"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('language', '"fr"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('briefing_mode', '"first_open"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('briefing_time', '"08:00"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('last_briefing_date', 'null', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('global_capture_shortcut', '"CommandOrControl+Shift+Space"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- ----------------------------------------------------------------------------
-- 9. Index de Performance (Objectif PRF-2 : 10 000 tâches & 5 000 événements)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_active_filter
ON tasks (status, category_id, due_date, priority DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_purge
ON tasks (deleted_at)
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_focus_items_day
ON focus_items (focus_day, position)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_range
ON calendar_events (start_at, end_at, source_id);

CREATE INDEX IF NOT EXISTS idx_launcher_pinned
ON launcher_items (is_pinned, position)
WHERE deleted_at IS NULL;