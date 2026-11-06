use chrono::Utc;
use rusqlite::{backup::Backup, params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use thiserror::Error;
use uuid::Uuid;

pub const MIGRATIONS: &[(i64, &str, &str)] = &[
    (
        1,
        "001_init.sql",
        include_str!("../../migrations/001_init.sql"),
    ),
    (
        2,
        "002_ui_design_system.sql",
        include_str!("../../migrations/002_ui_design_system.sql"),
    ),
    (
        3,
        "003_settings_and_quick_capture.sql",
        include_str!("../../migrations/003_settings_and_quick_capture.sql"),
    ),
    (
        4,
        "004_backup_settings.sql",
        include_str!("../../migrations/004_backup_settings.sql"),
    ),
];

pub const ALL_TABLES: &[&str] = &[
    "categories",
    "tasks",
    "focus_items",
    "calendar_sources",
    "calendar_events",
    "launcher_items",
    "commands",
    "settings",
];

pub const SYNCHRONIZABLE_TABLES: &[&str] = &[
    "categories",
    "tasks",
    "focus_items",
    "launcher_items",
    "commands",
];

pub const REQUIRED_SYNC_COLUMNS: &[&str] = &[
    "id",
    "created_at",
    "updated_at",
    "deleted_at",
    "device_id",
];

const DEFAULT_DEVICE_ID: &str = "local-device";

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Erreur SQLite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Erreur d'entrée/sortie: {0}")]
    Io(#[from] std::io::Error),
    #[error("Erreur de sérialisation JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Intégrité du schéma invalide: {0}")]
    SchemaIntegrity(String),
    #[error("Validation métier: {0}")]
    Validation(String),
    #[error("Élément introuvable: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Setting {
    pub key: String,
    pub value_json: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub alias: String,
    pub color: String,
    pub position: i64,
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreateCategoryInput {
    pub name: String,
    pub alias: Option<String>,
    pub color: Option<String>,
    pub position: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateCategoryInput {
    pub id: String,
    pub name: Option<String>,
    pub alias: Option<String>,
    pub color: Option<String>,
    pub position: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub category_id: String,
    pub status: String,
    pub priority: i64,
    pub due_date: Option<String>,
    pub has_due_time: bool,
    pub estimated_minutes: Option<i64>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreateTaskInput {
    pub title: String,
    pub notes: Option<String>,
    pub category_id: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i64>,
    pub due_date: Option<String>,
    pub has_due_time: Option<bool>,
    pub estimated_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub category_id: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i64>,
    pub due_date: Option<String>,
    pub clear_due_date: Option<bool>,
    pub has_due_time: Option<bool>,
    pub estimated_minutes: Option<i64>,
    pub clear_estimated_minutes: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FocusItem {
    pub id: String,
    pub focus_day: String,
    pub task_id: String,
    pub position: i64,
    pub outcome: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarSource {
    pub id: String,
    pub name: String,
    pub source_type: String,
    pub location_or_keychain_ref: String,
    pub refresh_interval_minutes: i64,
    pub last_synced_at: Option<String>,
    pub last_error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarEvent {
    pub id: String,
    pub source_id: String,
    pub ics_uid: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub is_all_day: bool,
    pub location: String,
    pub notes: String,
    pub rrule: Option<String>,
    pub exdates_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LauncherItem {
    pub id: String,
    pub label: String,
    pub item_type: String,
    pub target: String,
    pub icon: String,
    pub is_pinned: bool,
    pub group_name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandItem {
    pub id: String,
    pub label: String,
    pub alias: Option<String>,
    pub action_type: String,
    pub action_target: String,
    pub template_text: Option<String>,
    pub shortcut: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub device_id: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct RotationReport {
    pub daily_kept: usize,
    pub daily_deleted: usize,
    pub weekly_kept: usize,
    pub weekly_deleted: usize,
    pub deleted_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackupReport {
    pub performed: bool,
    pub backup_dir: String,
    pub daily_backup_path: Option<String>,
    pub weekly_backup_path: Option<String>,
    pub backup_date: String,
    pub rotation: RotationReport,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackupFileInfo {
    pub filename: String,
    pub path: String,
    pub kind: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FullDatabaseExport {
    pub format: String,
    pub schema_version: i64,
    pub exported_at: String,
    pub categories: Vec<Category>,
    pub tasks: Vec<Task>,
    pub focus_items: Vec<FocusItem>,
    pub calendar_sources: Vec<CalendarSource>,
    pub calendar_events: Vec<CalendarEvent>,
    pub launcher_items: Vec<LauncherItem>,
    pub commands: Vec<CommandItem>,
    pub settings: Vec<Setting>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct PurgeReport {
    pub focus_items_purged: usize,
    pub tasks_purged: usize,
    pub categories_purged: usize,
    pub launcher_items_purged: usize,
    pub commands_purged: usize,
    pub total_purged: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DbStatus {
    pub db_path: String,
    pub schema_version: i64,
    pub tables_verified: Vec<String>,
    pub sync_entities_verified: Vec<String>,
    pub last_purge_report: PurgeReport,
}

pub struct AppDbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
    pub last_purge_report: PurgeReport,
}

pub fn now_utc_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

pub fn configure_connection(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    Ok(())
}

/// Effectue une sauvegarde cohérente en ligne via l'API officielle `rusqlite::backup` [BKP-1, Section 6].
pub fn perform_online_backup(src_conn: &Connection, dest_path: &Path) -> Result<(), DbError> {
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut dest_conn = Connection::open(dest_path)?;
    {
        let backup = Backup::new(src_conn, &mut dest_conn)?;
        backup.run_to_completion(100, Duration::from_millis(10), None)?;
    }
    Ok(())
}

fn ensure_migrations_table(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )?;
    Ok(())
}

pub fn get_current_schema_version(conn: &Connection) -> Result<i64, DbError> {
    ensure_migrations_table(conn)?;
    let version: Option<i64> = conn
        .query_row("SELECT MAX(version) FROM _migrations", [], |row| row.get(0))
        .optional()?
        .flatten();
    Ok(version.unwrap_or(0))
}

/// Applique les migrations numérotées après sauvegarde préalable de la base [Section 6].
pub fn apply_migrations_with_list(
    conn: &mut Connection,
    db_path: Option<&Path>,
    migrations: &[(i64, &str, &str)],
) -> Result<Vec<PathBuf>, DbError> {
    configure_connection(conn)?;
    ensure_migrations_table(conn)?;

    let mut pending = Vec::new();
    for &(version, name, sql) in migrations {
        let already_applied: bool = conn
            .query_row(
                "SELECT 1 FROM _migrations WHERE version = ?1",
                params![version],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);

        if !already_applied {
            pending.push((version, name, sql));
        }
    }

    let mut created_backups = Vec::new();
    if pending.is_empty() {
        return Ok(created_backups);
    }

    if let Some(path) = db_path {
        let backup_dir = path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("backups");
        fs::create_dir_all(&backup_dir)?;
        let next_version = pending[0].0;
        let timestamp = Utc::now().format("%Y%m%dT%H%M%SZ");
        let backup_file = backup_dir.join(format!(
            "pre_migration_v{:03}_{}.db",
            next_version, timestamp
        ));
        perform_online_backup(conn, &backup_file)?;
        created_backups.push(backup_file);
    }

    for (version, name, sql) in pending {
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO _migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            params![version, name, now_utc_iso()],
        )?;
    }

    Ok(created_backups)
}

pub fn apply_migrations(
    conn: &mut Connection,
    db_path: Option<&Path>,
) -> Result<Vec<PathBuf>, DbError> {
    apply_migrations_with_list(conn, db_path, MIGRATIONS)
}

/// Vérifie que les 8 tables existent et que les 5 entités synchronisables possèdent
/// `id`, `created_at`, `updated_at`, `deleted_at` et `device_id` [Section 6].
pub fn verify_schema_integrity(conn: &Connection) -> Result<(), DbError> {
    for &table in ALL_TABLES {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![table],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);

        if !exists {
            return Err(DbError::SchemaIntegrity(format!(
                "Table obligatoire manquante : {}",
                table
            )));
        }
    }

    for &table in SYNCHRONIZABLE_TABLES {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;

        for &required_col in REQUIRED_SYNC_COLUMNS {
            if !columns.iter().any(|c| c == required_col) {
                return Err(DbError::SchemaIntegrity(format!(
                    "Colonne de synchronisation '{}' manquante sur la table '{}'",
                    required_col, table
                )));
            }
        }
    }

    Ok(())
}

/// Purge définitivement les enregistrements supprimés logiquement depuis plus de 30 jours [Section 6].
pub fn purge_expired_soft_deleted_at(
    conn: &Connection,
    reference_now_iso: &str,
) -> Result<PurgeReport, DbError> {
    let focus_items_purged = conn.execute(
        "DELETE FROM focus_items
         WHERE deleted_at IS NOT NULL
           AND (julianday(?1) - julianday(deleted_at)) > 30.0",
        params![reference_now_iso],
    )?;

    let tasks_purged = conn.execute(
        "DELETE FROM tasks
         WHERE deleted_at IS NOT NULL
           AND (julianday(?1) - julianday(deleted_at)) > 30.0",
        params![reference_now_iso],
    )?;

    let categories_purged = conn.execute(
        "DELETE FROM categories
         WHERE is_system = 0
           AND deleted_at IS NOT NULL
           AND (julianday(?1) - julianday(deleted_at)) > 30.0",
        params![reference_now_iso],
    )?;

    let launcher_items_purged = conn.execute(
        "DELETE FROM launcher_items
         WHERE deleted_at IS NOT NULL
           AND (julianday(?1) - julianday(deleted_at)) > 30.0",
        params![reference_now_iso],
    )?;

    let commands_purged = conn.execute(
        "DELETE FROM commands
         WHERE deleted_at IS NOT NULL
           AND (julianday(?1) - julianday(deleted_at)) > 30.0",
        params![reference_now_iso],
    )?;

    let total_purged = focus_items_purged
        + tasks_purged
        + categories_purged
        + launcher_items_purged
        + commands_purged;

    Ok(PurgeReport {
        focus_items_purged,
        tasks_purged,
        categories_purged,
        launcher_items_purged,
        commands_purged,
        total_purged,
    })
}

pub fn purge_expired_soft_deleted(conn: &Connection) -> Result<PurgeReport, DbError> {
    purge_expired_soft_deleted_at(conn, &now_utc_iso())
}

/// Initialise la base SQLite unique sur disque, applique les migrations avec backup préalable,
/// vérifie les colonnes de synchronisation et exécute la purge > 30 jours [Section 6].
pub fn initialize_database(db_path: &Path) -> Result<(Connection, PurgeReport), DbError> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut conn = Connection::open(db_path)?;
    configure_connection(&conn)?;
    apply_migrations(&mut conn, Some(db_path))?;
    verify_schema_integrity(&conn)?;
    let purge_report = purge_expired_soft_deleted(&conn)?;

    Ok((conn, purge_report))
}

// ============================================================================
// Settings Operations
// ============================================================================

pub fn query_all_settings(conn: &Connection) -> Result<Vec<Setting>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT key, value_json, updated_at
         FROM settings
         ORDER BY key ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value_json: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn query_setting(conn: &Connection, key: &str) -> Result<Option<Setting>, DbError> {
    let setting = conn
        .query_row(
            "SELECT key, value_json, updated_at FROM settings WHERE key = ?1",
            params![key],
            |row| {
                Ok(Setting {
                    key: row.get(0)?,
                    value_json: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            },
        )
        .optional()?;
    Ok(setting)
}

pub fn upsert_setting(conn: &Connection, key: &str, value_json: &str) -> Result<Setting, DbError> {
    if key.trim().is_empty() {
        return Err(DbError::Validation(
            "La clé de paramètre ne peut pas être vide.".to_string(),
        ));
    }

    if key == "theme" {
        let normalized = value_json.trim().trim_matches('"');
        if !matches!(normalized, "light" | "dark" | "system") {
            return Err(DbError::Validation(format!(
                "Valeur de thème invalide '{}'. Valeurs autorisées : light, dark, system.",
                normalized
            )));
        }
    }

    if key == "date_format" {
        let normalized = value_json.trim().trim_matches('"');
        if !matches!(normalized, "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD") {
            return Err(DbError::Validation(format!(
                "Format de date invalide '{}'. Valeurs autorisées : DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD.",
                normalized
            )));
        }
    }

    if key == "briefing_mode" {
        let normalized = value_json.trim().trim_matches('"');
        if !matches!(normalized, "first_open" | "fixed_time") {
            return Err(DbError::Validation(format!(
                "Mode de briefing invalide '{}'. Valeurs autorisées : first_open, fixed_time.",
                normalized
            )));
        }
    }

    let updated_at = now_utc_iso();
    conn.execute(
        "INSERT INTO settings (key, value_json, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET
             value_json = excluded.value_json,
             updated_at = excluded.updated_at",
        params![key, value_json, updated_at],
    )?;

    Ok(Setting {
        key: key.to_string(),
        value_json: value_json.to_string(),
        updated_at,
    })
}

// ============================================================================
// Category Operations [TSK-3]
// ============================================================================

fn map_category_row(row: &rusqlite::Row<'_>) -> Result<Category, rusqlite::Error> {
    let is_sys: i64 = row.get(5)?;
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        alias: row.get(2)?,
        color: row.get(3)?,
        position: row.get(4)?,
        is_system: is_sys != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        deleted_at: row.get(8)?,
        device_id: row.get(9)?,
    })
}

pub fn query_active_categories(conn: &Connection) -> Result<Vec<Category>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id
         FROM categories
         WHERE deleted_at IS NULL
         ORDER BY position ASC, created_at ASC",
    )?;
    let categories = stmt
        .query_map([], map_category_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}

pub fn get_category_by_id(conn: &Connection, id: &str) -> Result<Option<Category>, DbError> {
    let cat = conn
        .query_row(
            "SELECT id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id
             FROM categories
             WHERE id = ?1",
            params![id],
            map_category_row,
        )
        .optional()?;
    Ok(cat)
}

pub fn create_category(
    conn: &Connection,
    input: CreateCategoryInput,
) -> Result<Category, DbError> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(DbError::Validation(
            "Le nom de la catégorie est obligatoire.".to_string(),
        ));
    }

    let alias = input
        .alias
        .map(|a| a.trim().to_lowercase())
        .filter(|a| !a.is_empty())
        .unwrap_or_else(|| {
            name.to_lowercase()
                .chars()
                .filter(|c| c.is_alphanumeric())
                .collect()
        });

    let color = input
        .color
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "--cat-1".to_string());

    let next_pos: i64 = match input.position {
        Some(p) => p,
        None => {
            let max_pos: Option<i64> = conn
                .query_row(
                    "SELECT MAX(position) FROM categories WHERE deleted_at IS NULL",
                    [],
                    |r| r.get(0),
                )
                .optional()?
                .flatten();
            max_pos.unwrap_or(0) + 1
        }
    };

    let id = format!("cat-{}", Uuid::new_v4());
    let now = now_utc_iso();
    conn.execute(
        "INSERT INTO categories (id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, NULL, ?8)",
        params![id, name, alias, color, next_pos, now, now, DEFAULT_DEVICE_ID],
    )?;

    get_category_by_id(conn, &id)?
        .ok_or_else(|| DbError::NotFound(format!("Catégorie '{}' introuvable après création", id)))
}

pub fn update_category(
    conn: &Connection,
    input: UpdateCategoryInput,
) -> Result<Category, DbError> {
    let existing = get_category_by_id(conn, &input.id)?
        .ok_or_else(|| DbError::NotFound(format!("Catégorie '{}' introuvable", input.id)))?;

    let name = match input.name {
        Some(n) => {
            let trimmed = n.trim().to_string();
            if trimmed.is_empty() {
                return Err(DbError::Validation(
                    "Le nom de la catégorie ne peut pas être vide.".to_string(),
                ));
            }
            trimmed
        }
        None => existing.name,
    };

    let alias = match input.alias {
        Some(a) => {
            let trimmed = a.trim().to_lowercase();
            if trimmed.is_empty() {
                existing.alias
            } else {
                trimmed
            }
        }
        None => existing.alias,
    };

    let color = input
        .color
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
        .unwrap_or(existing.color);

    let position = input.position.unwrap_or(existing.position);
    let now = now_utc_iso();

    conn.execute(
        "UPDATE categories
         SET name = ?1, alias = ?2, color = ?3, position = ?4, updated_at = ?5
         WHERE id = ?6",
        params![name, alias, color, position, now, input.id],
    )?;

    get_category_by_id(conn, &input.id)?
        .ok_or_else(|| DbError::NotFound(format!("Catégorie '{}' introuvable", input.id)))
}

pub fn delete_category(conn: &Connection, id: &str) -> Result<(), DbError> {
    let existing = get_category_by_id(conn, id)?
        .ok_or_else(|| DbError::NotFound(format!("Catégorie '{}' introuvable", id)))?;

    if existing.is_system {
        return Err(DbError::Validation(
            "Impossible de supprimer la catégorie système Inbox [TSK-3].".to_string(),
        ));
    }

    let now = now_utc_iso();
    conn.execute(
        "UPDATE categories SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

// ============================================================================
// Task Operations [TSK-1, TSK-2, TSK-4, TSK-5]
// ============================================================================

fn map_task_row(row: &rusqlite::Row<'_>) -> Result<Task, rusqlite::Error> {
    let has_due_time_int: i64 = row.get(7)?;
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        notes: row.get(2)?,
        category_id: row.get(3)?,
        status: row.get(4)?,
        priority: row.get(5)?,
        due_date: row.get(6)?,
        has_due_time: has_due_time_int != 0,
        estimated_minutes: row.get(8)?,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        deleted_at: row.get(12)?,
        device_id: row.get(13)?,
    })
}

pub fn query_active_tasks(conn: &Connection) -> Result<Vec<Task>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, notes, category_id, status, priority, due_date, has_due_time,
                estimated_minutes, completed_at, created_at, updated_at, deleted_at, device_id
         FROM tasks
         WHERE deleted_at IS NULL
         ORDER BY
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
            due_date ASC,
            priority DESC,
            created_at ASC",
    )?;
    let tasks = stmt
        .query_map([], map_task_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tasks)
}

pub fn get_task_by_id(conn: &Connection, id: &str) -> Result<Option<Task>, DbError> {
    let task = conn
        .query_row(
            "SELECT id, title, notes, category_id, status, priority, due_date, has_due_time,
                    estimated_minutes, completed_at, created_at, updated_at, deleted_at, device_id
             FROM tasks
             WHERE id = ?1",
            params![id],
            map_task_row,
        )
        .optional()?;
    Ok(task)
}

pub fn create_task(conn: &Connection, input: CreateTaskInput) -> Result<Task, DbError> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(DbError::Validation(
            "Le titre de la tâche est obligatoire [TSK-1].".to_string(),
        ));
    }

    let notes = input.notes.unwrap_or_default();
    let category_id = input
        .category_id
        .filter(|c| !c.trim().is_empty())
        .unwrap_or_else(|| "cat-inbox".to_string());

    // Vérifier si la catégorie existe et est active, sinon repli sur cat-inbox [CAP-3]
    let valid_category_id = match get_category_by_id(conn, &category_id)? {
        Some(cat) if cat.deleted_at.is_none() => cat.id,
        _ => "cat-inbox".to_string(),
    };

    let status = input.status.unwrap_or_else(|| "todo".to_string());
    if !matches!(
        status.as_str(),
        "todo" | "in_progress" | "done" | "cancelled"
    ) {
        return Err(DbError::Validation(format!(
            "Statut de tâche invalide : {}",
            status
        )));
    }

    let priority = input.priority.unwrap_or(0).clamp(0, 3);
    let due_date = input.due_date.filter(|d| !d.trim().is_empty());
    let has_due_time = if input.has_due_time.unwrap_or(false) {
        1
    } else {
        0
    };
    let estimated_minutes = input.estimated_minutes.filter(|&m| m > 0);

    let now = now_utc_iso();
    let completed_at = if status == "done" {
        Some(now.clone())
    } else {
        None
    };

    let id = format!("task-{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO tasks (
            id, title, notes, category_id, status, priority, due_date, has_due_time,
            estimated_minutes, completed_at, created_at, updated_at, deleted_at, device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, ?13)",
        params![
            id,
            title,
            notes,
            valid_category_id,
            status,
            priority,
            due_date,
            has_due_time,
            estimated_minutes,
            completed_at,
            now,
            now,
            DEFAULT_DEVICE_ID
        ],
    )?;

    get_task_by_id(conn, &id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable après création", id)))
}

pub fn update_task(conn: &Connection, input: UpdateTaskInput) -> Result<Task, DbError> {
    let existing = get_task_by_id(conn, &input.id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", input.id)))?;

    let title = match input.title {
        Some(t) => {
            let trimmed = t.trim().to_string();
            if trimmed.is_empty() {
                return Err(DbError::Validation(
                    "Le titre de la tâche ne peut pas être vide [TSK-1].".to_string(),
                ));
            }
            trimmed
        }
        None => existing.title,
    };

    let notes = input.notes.unwrap_or(existing.notes);
    let category_id = match input.category_id {
        Some(cid) => match get_category_by_id(conn, &cid)? {
            Some(cat) if cat.deleted_at.is_none() => cat.id,
            _ => "cat-inbox".to_string(),
        },
        None => existing.category_id,
    };

    let status = input.status.unwrap_or(existing.status.clone());
    if !matches!(
        status.as_str(),
        "todo" | "in_progress" | "done" | "cancelled"
    ) {
        return Err(DbError::Validation(format!(
            "Statut de tâche invalide : {}",
            status
        )));
    }

    let priority = input
        .priority
        .map(|p| p.clamp(0, 3))
        .unwrap_or(existing.priority);

    let due_date = if input.clear_due_date.unwrap_or(false) {
        None
    } else {
        match input.due_date {
            Some(d) if d.trim().is_empty() => None,
            Some(d) => Some(d),
            None => existing.due_date,
        }
    };

    let has_due_time = input.has_due_time.unwrap_or(existing.has_due_time);
    let estimated_minutes = if input.clear_estimated_minutes.unwrap_or(false) {
        None
    } else {
        match input.estimated_minutes {
            Some(m) if m > 0 => Some(m),
            Some(_) => None,
            None => existing.estimated_minutes,
        }
    };

    let now = now_utc_iso();
    let completed_at = if status == "done" {
        existing.completed_at.or_else(|| Some(now.clone()))
    } else {
        None
    };

    conn.execute(
        "UPDATE tasks
         SET title = ?1,
             notes = ?2,
             category_id = ?3,
             status = ?4,
             priority = ?5,
             due_date = ?6,
             has_due_time = ?7,
             estimated_minutes = ?8,
             completed_at = ?9,
             updated_at = ?10
         WHERE id = ?11",
        params![
            title,
            notes,
            category_id,
            status,
            priority,
            due_date,
            if has_due_time { 1 } else { 0 },
            estimated_minutes,
            completed_at,
            now,
            input.id
        ],
    )?;

    // Synchroniser l'issue dans focus_items si le statut passe à done ou revient à todo [FOC-2]
    let focus_outcome: Option<&str> = if status == "done" {
        Some("completed")
    } else {
        None
    };
    conn.execute(
        "UPDATE focus_items
         SET outcome = ?1, updated_at = ?2
         WHERE task_id = ?3 AND deleted_at IS NULL",
        params![focus_outcome, now, input.id],
    )?;

    get_task_by_id(conn, &input.id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", input.id)))
}

pub fn complete_task(conn: &Connection, id: &str, completed: bool) -> Result<Task, DbError> {
    let status = if completed { "done" } else { "todo" };
    update_task(
        conn,
        UpdateTaskInput {
            id: id.to_string(),
            status: Some(status.to_string()),
            ..Default::default()
        },
    )
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<Task, DbError> {
    let _existing = get_task_by_id(conn, id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", id)))?;

    let now = now_utc_iso();
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;

    // Libérer la place dans le Focus si la tâche était présente
    let affected_days: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT focus_day FROM focus_items WHERE task_id = ?1 AND deleted_at IS NULL",
        )?;
        let rows = stmt
            .query_map(params![id], |r| r.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    conn.execute(
        "UPDATE focus_items SET deleted_at = ?1, updated_at = ?1 WHERE task_id = ?2 AND deleted_at IS NULL",
        params![now, id],
    )?;

    for day in affected_days {
        compact_focus_positions(conn, &day)?;
    }

    get_task_by_id(conn, id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", id)))
}

pub fn restore_task(conn: &Connection, id: &str) -> Result<Task, DbError> {
    let _existing = get_task_by_id(conn, id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", id)))?;

    let now = now_utc_iso();
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;

    get_task_by_id(conn, id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", id)))
}

// ============================================================================
// Focus 5 Operations [FOC-1, FOC-2]
// ============================================================================

fn map_focus_row(row: &rusqlite::Row<'_>) -> Result<FocusItem, rusqlite::Error> {
    Ok(FocusItem {
        id: row.get(0)?,
        focus_day: row.get(1)?,
        task_id: row.get(2)?,
        position: row.get(3)?,
        outcome: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        deleted_at: row.get(7)?,
        device_id: row.get(8)?,
    })
}

pub fn query_focus_items_by_day(
    conn: &Connection,
    focus_day: &str,
) -> Result<Vec<FocusItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, focus_day, task_id, position, outcome, created_at, updated_at, deleted_at, device_id
         FROM focus_items
         WHERE focus_day = ?1 AND deleted_at IS NULL
         ORDER BY position ASC, created_at ASC",
    )?;
    let items = stmt
        .query_map(params![focus_day], map_focus_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

fn compact_focus_positions(conn: &Connection, focus_day: &str) -> Result<(), DbError> {
    let current = query_focus_items_by_day(conn, focus_day)?;
    let now = now_utc_iso();
    for (idx, item) in current.iter().enumerate() {
        let desired_pos = (idx as i64) + 1;
        if item.position != desired_pos {
            conn.execute(
                "UPDATE focus_items SET position = ?1, updated_at = ?2 WHERE id = ?3",
                params![desired_pos, now, item.id],
            )?;
        }
    }
    Ok(())
}

pub fn add_focus_item(
    conn: &Connection,
    focus_day: &str,
    task_id: &str,
) -> Result<FocusItem, DbError> {
    let task = get_task_by_id(conn, task_id)?
        .ok_or_else(|| DbError::NotFound(format!("Tâche '{}' introuvable", task_id)))?;

    if task.deleted_at.is_some() {
        return Err(DbError::Validation(
            "Impossible d'ajouter une tâche supprimée au Focus.".to_string(),
        ));
    }

    let current = query_focus_items_by_day(conn, focus_day)?;
    if current.iter().any(|item| item.task_id == task_id) {
        return Err(DbError::Validation(
            "Cette tâche figure déjà dans le Focus du jour [FOC-1].".to_string(),
        ));
    }

    if current.len() >= 5 {
        return Err(DbError::Validation(
            "Limite atteinte : Le Focus du jour ne peut pas contenir plus de 5 tâches [FOC-1]."
                .to_string(),
        ));
    }

    let position = (current.len() as i64) + 1;
    let outcome = if task.status == "done" {
        Some("completed".to_string())
    } else {
        None
    };

    let id = format!("focus-{}", Uuid::new_v4());
    let now = now_utc_iso();

    conn.execute(
        "INSERT INTO focus_items (id, focus_day, task_id, position, outcome, created_at, updated_at, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8)",
        params![
            id,
            focus_day,
            task_id,
            position,
            outcome,
            now,
            now,
            DEFAULT_DEVICE_ID
        ],
    )?;

    Ok(FocusItem {
        id,
        focus_day: focus_day.to_string(),
        task_id: task_id.to_string(),
        position,
        outcome,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
        device_id: DEFAULT_DEVICE_ID.to_string(),
    })
}

pub fn remove_focus_item(conn: &Connection, focus_day: &str, task_id: &str) -> Result<(), DbError> {
    let now = now_utc_iso();
    let updated = conn.execute(
        "UPDATE focus_items
         SET deleted_at = ?1, updated_at = ?1
         WHERE focus_day = ?2 AND task_id = ?3 AND deleted_at IS NULL",
        params![now, focus_day, task_id],
    )?;

    if updated == 0 {
        return Err(DbError::NotFound(format!(
            "La tâche '{}' n'est pas dans le Focus du {}",
            task_id, focus_day
        )));
    }

    compact_focus_positions(conn, focus_day)?;
    Ok(())
}

pub fn reorder_focus_items(
    conn: &Connection,
    focus_day: &str,
    ordered_task_ids: &[String],
) -> Result<Vec<FocusItem>, DbError> {
    let current = query_focus_items_by_day(conn, focus_day)?;
    if current.is_empty() {
        return Ok(current);
    }

    let now = now_utc_iso();
    let mut next_position = 1_i64;
    for task_id in ordered_task_ids {
        if let Some(item) = current.iter().find(|i| &i.task_id == task_id) {
            if next_position <= 5 {
                conn.execute(
                    "UPDATE focus_items SET position = ?1, updated_at = ?2 WHERE id = ?3",
                    params![next_position, now, item.id],
                )?;
                next_position += 1;
            }
        }
    }

    // Tout élément actif non listé conserve une position valide à la suite
    for item in &current {
        if !ordered_task_ids.contains(&item.task_id) && next_position <= 5 {
            conn.execute(
                "UPDATE focus_items SET position = ?1, updated_at = ?2 WHERE id = ?3",
                params![next_position, now, item.id],
            )?;
            next_position += 1;
        }
    }

    query_focus_items_by_day(conn, focus_day)
}

/// Renvoie les `FocusItem` actifs (`deleted_at IS NULL`) des jours strictement antérieurs à
/// `before_focus_day` (`focus_day < ?1`) dont l'issue n'est ni `'completed'` ni `'abandoned'`
/// et dont la tâche associée est encore active et non terminée (`status NOT IN ('done', 'cancelled')`),
/// sans jamais les copier automatiquement dans le jour courant [FOC-3].
pub fn query_uncompleted_past_focus_items(
    conn: &Connection,
    before_focus_day: &str,
) -> Result<Vec<FocusItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.focus_day, f.task_id, f.position, f.outcome,
                f.created_at, f.updated_at, f.deleted_at, f.device_id
         FROM focus_items f
         INNER JOIN tasks t ON t.id = f.task_id
         WHERE f.focus_day < ?1
           AND f.deleted_at IS NULL
           AND (f.outcome IS NULL OR (f.outcome != 'completed' AND f.outcome != 'abandoned'))
           AND t.deleted_at IS NULL
           AND t.status NOT IN ('done', 'cancelled')
         ORDER BY f.focus_day DESC, f.position ASC",
    )?;
    let items = stmt
        .query_map(params![before_focus_day], map_focus_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

// ============================================================================
// Sauvegarde automatique en ligne SQLite, Rotation 7j/4sem & Export JSON [BKP-1, BKP-2, BKP-3]
// ============================================================================

pub const EXPORT_FORMAT_V1: &str = "productivity-dashboard-backup-v1";
pub const MAX_DAILY_BACKUPS: usize = 7;
pub const MAX_WEEKLY_BACKUPS: usize = 4;

/// Résout le dossier de sauvegarde actif à partir de `settings.backup_dir`
/// ou replie sur `<parent de dashboard.db>/backups` [BKP-2].
pub fn resolve_backup_dir(conn: &Connection, default_db_path: &Path) -> PathBuf {
    let default_dir = default_db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups");

    if let Ok(Some(setting)) = query_setting(conn, "backup_dir") {
        let parsed = serde_json::from_str::<String>(&setting.value_json)
            .unwrap_or_else(|_| setting.value_json.trim().trim_matches('"').to_string());
        let trimmed = parsed.trim();
        if !trimmed.is_empty() && trimmed != "null" {
            let candidate = PathBuf::from(trimmed);
            if fs::create_dir_all(&candidate).is_ok() {
                return candidate;
            }
        }
    }

    let _ = fs::create_dir_all(&default_dir);
    default_dir
}

/// Applique la politique de rotation des sauvegardes [BKP-2] :
/// - conserve uniquement les 7 plus récentes sauvegardes `daily-*.db` ;
/// - conserve uniquement les 4 plus récentes sauvegardes `weekly-*.db` ;
/// - ne supprime jamais les sauvegardes `pre_migration_*` ou autres fichiers.
pub fn rotate_backups(backup_dir: &Path) -> Result<RotationReport, DbError> {
    if !backup_dir.exists() {
        return Ok(RotationReport::default());
    }

    let mut daily_files: Vec<(String, PathBuf)> = Vec::new();
    let mut weekly_files: Vec<(String, PathBuf)> = Vec::new();

    for entry in fs::read_dir(backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if filename.starts_with("daily-") && filename.ends_with(".db") {
            daily_files.push((filename.to_string(), path));
        } else if filename.starts_with("weekly-") && filename.ends_with(".db") {
            weekly_files.push((filename.to_string(), path));
        }
    }

    // Tri décroissant par nom ISO (ex: daily-2026-11-10.db > daily-2026-11-09.db)
    daily_files.sort_by(|a, b| b.0.cmp(&a.0));
    weekly_files.sort_by(|a, b| b.0.cmp(&a.0));

    let mut deleted_files = Vec::new();
    let mut daily_deleted = 0usize;
    let mut weekly_deleted = 0usize;

    for (name, path) in daily_files.iter().skip(MAX_DAILY_BACKUPS) {
        fs::remove_file(path)?;
        daily_deleted += 1;
        deleted_files.push(name.clone());
    }

    for (name, path) in weekly_files.iter().skip(MAX_WEEKLY_BACKUPS) {
        fs::remove_file(path)?;
        weekly_deleted += 1;
        deleted_files.push(name.clone());
    }

    let daily_kept = daily_files.len().saturating_sub(daily_deleted);
    let weekly_kept = weekly_files.len().saturating_sub(weekly_deleted);

    Ok(RotationReport {
        daily_kept,
        daily_deleted,
        weekly_kept,
        weekly_deleted,
        deleted_files,
    })
}

/// Exécute la sauvegarde en ligne SQLite quotidienne et hebdomadaire puis applique la rotation 7j/4sem [BKP-1, BKP-2].
/// - Si `force == false` (ex. au démarrage), ne refait pas la sauvegarde si `daily-YYYY-MM-DD.db`
///   et `weekly-YYYY-Www.db` existent déjà et que `last_auto_backup_date` correspond à la date du jour.
/// - Si `force == true` (ex. à la fermeture de l'application ou sur demande manuelle),
///   met à jour la sauvegarde en ligne quotidienne (et hebdomadaire).
pub fn run_scheduled_or_exit_backup(
    conn: &Connection,
    default_db_path: &Path,
    now_utc: chrono::DateTime<Utc>,
    force: bool,
) -> Result<BackupReport, DbError> {
    let backup_dir = resolve_backup_dir(conn, default_db_path);
    fs::create_dir_all(&backup_dir)?;

    let date_str = now_utc.format("%Y-%m-%d").to_string();
    let week_str = now_utc.format("%G-W%V").to_string();

    let daily_filename = format!("daily-{}.db", date_str);
    let weekly_filename = format!("weekly-{}.db", week_str);

    let daily_path = backup_dir.join(&daily_filename);
    let weekly_path = backup_dir.join(&weekly_filename);

    let last_backup_date = query_setting(conn, "last_auto_backup_date")?
        .map(|s| s.value_json.trim().trim_matches('"').to_string())
        .unwrap_or_default();

    let already_backed_up_today =
        !force && last_backup_date == date_str && daily_path.exists() && weekly_path.exists();

    if already_backed_up_today {
        let rotation = rotate_backups(&backup_dir)?;
        return Ok(BackupReport {
            performed: false,
            backup_dir: backup_dir.to_string_lossy().into_owned(),
            daily_backup_path: Some(daily_path.to_string_lossy().into_owned()),
            weekly_backup_path: Some(weekly_path.to_string_lossy().into_owned()),
            backup_date: date_str,
            rotation,
        });
    }

    // Mettre à jour last_auto_backup_date avant le backup en ligne pour que la copie SQLite embarque l'horodatage à jour
    let date_json = format!("\"{}\"", date_str);
    upsert_setting(conn, "last_auto_backup_date", &date_json)?;

    perform_online_backup(conn, &daily_path)?;
    if force || !weekly_path.exists() {
        perform_online_backup(conn, &weekly_path)?;
    }

    let rotation = rotate_backups(&backup_dir)?;

    Ok(BackupReport {
        performed: true,
        backup_dir: backup_dir.to_string_lossy().into_owned(),
        daily_backup_path: Some(daily_path.to_string_lossy().into_owned()),
        weekly_backup_path: Some(weekly_path.to_string_lossy().into_owned()),
        backup_date: date_str,
        rotation,
    })
}

/// Liste les fichiers de sauvegarde SQLite présents dans le dossier actif [BKP-2].
pub fn list_backup_files(
    conn: &Connection,
    default_db_path: &Path,
) -> Result<Vec<BackupFileInfo>, DbError> {
    let backup_dir = resolve_backup_dir(conn, default_db_path);
    if !backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(&backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !filename.ends_with(".db") {
            continue;
        }

        let kind = if filename.starts_with("daily-") {
            "daily"
        } else if filename.starts_with("weekly-") {
            "weekly"
        } else if filename.starts_with("pre_migration_") || filename.starts_with("pre-migration-") {
            "pre_migration"
        } else {
            continue;
        };

        let metadata = entry.metadata()?;
        let size_bytes = metadata.len();
        let modified_at = metadata
            .modified()
            .ok()
            .map(|t| {
                let dt: chrono::DateTime<Utc> = t.into();
                dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
            })
            .unwrap_or_else(now_utc_iso);

        files.push(BackupFileInfo {
            filename: filename.to_string(),
            path: path.to_string_lossy().into_owned(),
            kind: kind.to_string(),
            size_bytes,
            modified_at,
        });
    }

    files.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(files)
}

fn query_all_categories_for_export(conn: &Connection) -> Result<Vec<Category>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id
         FROM categories
         ORDER BY position ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map([], map_category_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_tasks_for_export(conn: &Connection) -> Result<Vec<Task>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, notes, category_id, status, priority, due_date, has_due_time,
                estimated_minutes, completed_at, created_at, updated_at, deleted_at, device_id
         FROM tasks
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt
        .query_map([], map_task_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_focus_items_for_export(conn: &Connection) -> Result<Vec<FocusItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, focus_day, task_id, position, outcome, created_at, updated_at, deleted_at, device_id
         FROM focus_items
         ORDER BY focus_day ASC, position ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map([], map_focus_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_calendar_sources_for_export(conn: &Connection) -> Result<Vec<CalendarSource>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, source_type, location_or_keychain_ref, refresh_interval_minutes,
                last_synced_at, last_error, created_at, updated_at
         FROM calendar_sources
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CalendarSource {
                id: row.get(0)?,
                name: row.get(1)?,
                source_type: row.get(2)?,
                location_or_keychain_ref: row.get(3)?,
                refresh_interval_minutes: row.get(4)?,
                last_synced_at: row.get(5)?,
                last_error: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_calendar_events_for_export(conn: &Connection) -> Result<Vec<CalendarEvent>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, source_id, ics_uid, title, start_at, end_at, is_all_day, location, notes, rrule, exdates_json
         FROM calendar_events
         ORDER BY start_at ASC, id ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            let is_all_day_int: i64 = row.get(6)?;
            Ok(CalendarEvent {
                id: row.get(0)?,
                source_id: row.get(1)?,
                ics_uid: row.get(2)?,
                title: row.get(3)?,
                start_at: row.get(4)?,
                end_at: row.get(5)?,
                is_all_day: is_all_day_int != 0,
                location: row.get(7)?,
                notes: row.get(8)?,
                rrule: row.get(9)?,
                exdates_json: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_launcher_items_for_export(conn: &Connection) -> Result<Vec<LauncherItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, label, item_type, target, icon, is_pinned, group_name, position,
                created_at, updated_at, deleted_at, device_id
         FROM launcher_items
         ORDER BY position ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            let is_pinned_int: i64 = row.get(5)?;
            Ok(LauncherItem {
                id: row.get(0)?,
                label: row.get(1)?,
                item_type: row.get(2)?,
                target: row.get(3)?,
                icon: row.get(4)?,
                is_pinned: is_pinned_int != 0,
                group_name: row.get(6)?,
                position: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                deleted_at: row.get(10)?,
                device_id: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn query_all_commands_for_export(conn: &Connection) -> Result<Vec<CommandItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, label, alias, action_type, action_target, template_text, shortcut,
                created_at, updated_at, deleted_at, device_id
         FROM commands
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CommandItem {
                id: row.get(0)?,
                label: row.get(1)?,
                alias: row.get(2)?,
                action_type: row.get(3)?,
                action_target: row.get(4)?,
                template_text: row.get(5)?,
                shortcut: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                deleted_at: row.get(9)?,
                device_id: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// Exporte l'intégralité des 8 tables de la base SQLite dans une structure sérialisable en JSON [BKP-3].
pub fn export_full_database_json(conn: &Connection) -> Result<FullDatabaseExport, DbError> {
    let schema_version = get_current_schema_version(conn)?;
    Ok(FullDatabaseExport {
        format: EXPORT_FORMAT_V1.to_string(),
        schema_version,
        exported_at: now_utc_iso(),
        categories: query_all_categories_for_export(conn)?,
        tasks: query_all_tasks_for_export(conn)?,
        focus_items: query_all_focus_items_for_export(conn)?,
        calendar_sources: query_all_calendar_sources_for_export(conn)?,
        calendar_events: query_all_calendar_events_for_export(conn)?,
        launcher_items: query_all_launcher_items_for_export(conn)?,
        commands: query_all_commands_for_export(conn)?,
        settings: query_all_settings(conn)?,
    })
}

/// Sérialise l'export complet en JSON indenté lisible [BKP-3].
pub fn export_full_database_pretty_json(conn: &Connection) -> Result<String, DbError> {
    let payload = export_full_database_json(conn)?;
    Ok(serde_json::to_string_pretty(&payload)?)
}

/// Désérialise et valide une archive JSON complète pour prouver qu'elle est 100 % réimportable [BKP-3].
pub fn parse_full_database_json(json_str: &str) -> Result<FullDatabaseExport, DbError> {
    let parsed: FullDatabaseExport = serde_json::from_str(json_str)?;
    if parsed.format != EXPORT_FORMAT_V1 {
        return Err(DbError::Validation(format!(
            "Format d'export JSON non reconnu : '{}' (attendu : '{}').",
            parsed.format, EXPORT_FORMAT_V1
        )));
    }
    if parsed.schema_version < 1 {
        return Err(DbError::Validation(format!(
            "Version de schéma invalide dans l'export JSON : {}.",
            parsed.schema_version
        )));
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_001_and_002_migrations_and_sync_columns() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");

        let (conn, purge_report) =
            initialize_database(&db_path).expect("initialisation de la base SQLite");

        assert_eq!(purge_report.total_purged, 0);
        assert_eq!(
            get_current_schema_version(&conn).expect("version du schéma"),
            4
        );

        verify_schema_integrity(&conn).expect("intégrité du schéma valide");

        // Vérifier les clés settings du LOT A.1, Migration 003 et Migration 004
        let backup_dir_setting = query_setting(&conn, "backup_dir")
            .expect("lecture backup_dir")
            .expect("backup_dir existe");
        assert_eq!(backup_dir_setting.value_json, "\"\"");

        let last_auto_backup = query_setting(&conn, "last_auto_backup_date")
            .expect("lecture last_auto_backup_date")
            .expect("last_auto_backup_date existe");
        assert_eq!(last_auto_backup.value_json, "null");
        let theme = query_setting(&conn, "theme")
            .expect("lecture theme")
            .expect("theme existe");
        assert!(matches!(
            theme.value_json.as_str(),
            "\"system\"" | "\"light\"" | "\"dark\""
        ));

        let date_format = query_setting(&conn, "date_format")
            .expect("lecture date_format")
            .expect("date_format existe");
        assert_eq!(date_format.value_json, "\"DD-MM-YYYY\"");

        let panel_collapsed = query_setting(&conn, "quick_capture_panel_collapsed")
            .expect("lecture quick_capture_panel_collapsed")
            .expect("quick_capture_panel_collapsed existe");
        assert_eq!(panel_collapsed.value_json, "false");

        let briefing_mode = query_setting(&conn, "briefing_mode")
            .expect("lecture briefing_mode")
            .expect("briefing_mode existe");
        assert_eq!(briefing_mode.value_json, "\"first_open\"");

        let active_palette = query_setting(&conn, "active_palette")
            .expect("lecture active_palette")
            .expect("active_palette existe");
        assert_eq!(active_palette.value_json, "\"coolors-classic\"");

        let custom_palettes = query_setting(&conn, "custom_palettes")
            .expect("lecture custom_palettes")
            .expect("custom_palettes existe");
        assert_eq!(custom_palettes.value_json, "[]");

        let user_name = query_setting(&conn, "user_name")
            .expect("lecture user_name")
            .expect("user_name existe");
        assert_eq!(user_name.value_json, "\"\"");

        // Vérifier les tokens de couleurs --cat-1..5 sur les catégories par défaut
        let cats = query_active_categories(&conn).expect("catégories");
        assert_eq!(cats.len(), 5);
        assert_eq!(cats[0].color, "--cat-1");
        assert_eq!(cats[1].color, "--cat-2");
        assert_eq!(cats[2].color, "--cat-3");
        assert_eq!(cats[3].color, "--cat-4");
        assert_eq!(cats[4].color, "--cat-5");
    }

    #[test]
    fn test_pre_migration_online_backup() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");

        let (mut conn, _) = initialize_database(&db_path).expect("init v4");

        let backups_dir = tmp_dir.path().join("backups");
        assert!(backups_dir.exists(), "Le dossier backups/ doit exister");

        conn.execute(
            "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, device_id)
             VALUES ('task-before-v5', 'Tâche avant migration v5', 'cat-inbox', 'todo', 2, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', 'dev-1')",
            [],
        )
        .expect("insertion tâche v4");

        let migrations_v5: &[(i64, &str, &str)] = &[
            (
                1,
                "001_init.sql",
                include_str!("../../migrations/001_init.sql"),
            ),
            (
                2,
                "002_ui_design_system.sql",
                include_str!("../../migrations/002_ui_design_system.sql"),
            ),
            (
                3,
                "003_settings_and_quick_capture.sql",
                include_str!("../../migrations/003_settings_and_quick_capture.sql"),
            ),
            (
                4,
                "004_backup_settings.sql",
                include_str!("../../migrations/004_backup_settings.sql"),
            ),
            (
                5,
                "005_test_setting.sql",
                "INSERT INTO settings (key, value_json, updated_at) VALUES ('migration_v5_flag', 'true', '2026-11-01T12:00:00Z');",
            ),
        ];

        let created_backups = apply_migrations_with_list(&mut conn, Some(&db_path), migrations_v5)
            .expect("application migration v5 avec backup");

        assert_eq!(created_backups.len(), 1);
        let backup_path = &created_backups[0];
        assert!(backup_path.exists());

        let backup_conn = Connection::open(backup_path).expect("ouverture du backup SQLite");
        let backup_version = get_current_schema_version(&backup_conn).expect("version backup");
        assert_eq!(backup_version, 4);

        let task_title: String = backup_conn
            .query_row(
                "SELECT title FROM tasks WHERE id = 'task-before-v5'",
                [],
                |r| r.get(0),
            )
            .expect("tâche présente dans le backup");
        assert_eq!(task_title, "Tâche avant migration v5");

        let v5_setting =
            query_setting(&backup_conn, "migration_v5_flag").expect("lecture setting backup");
        assert!(v5_setting.is_none());
    }

    #[test]
    fn test_default_categories_and_inbox_protection_tsk3() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let categories = query_active_categories(&conn).expect("lecture des catégories");
        assert_eq!(categories.len(), 5);
        let names: Vec<&str> = categories.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, vec!["Inbox", "École", "Sport", "Perso", "Projets"]);
        assert!(categories[0].is_system);

        let delete_inbox_res = delete_category(&conn, "cat-inbox");
        assert!(
            delete_inbox_res.is_err(),
            "La suppression d'Inbox doit échouer"
        );

        let created_cat = create_category(
            &conn,
            CreateCategoryInput {
                name: "Musique".to_string(),
                alias: Some("mus".to_string()),
                color: Some("--cat-6".to_string()),
                position: None,
            },
        )
        .expect("création catégorie Musique");
        assert_eq!(created_cat.name, "Musique");
        assert_eq!(created_cat.color, "--cat-6");

        let updated_cat = update_category(
            &conn,
            UpdateCategoryInput {
                id: created_cat.id.clone(),
                name: Some("Musique & Guitare".to_string()),
                alias: None,
                color: Some("--cat-7".to_string()),
                position: None,
            },
        )
        .expect("modification catégorie");
        assert_eq!(updated_cat.name, "Musique & Guitare");
        assert_eq!(updated_cat.color, "--cat-7");

        let task = create_task(
            &conn,
            CreateTaskInput {
                title: "Réviser cours Rust".to_string(),
                category_id: Some("cat-ecole".to_string()),
                priority: Some(2),
                ..Default::default()
            },
        )
        .expect("création tâche dans École");

        delete_category(&conn, "cat-ecole").expect("suppression logique de la catégorie École");

        let reassigned = get_task_by_id(&conn, &task.id)
            .expect("lecture tâche")
            .expect("tâche existe");
        assert_eq!(reassigned.category_id, "cat-inbox");
    }

    #[test]
    fn test_task_and_focus_crud_operations() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let mut created_ids = Vec::new();
        for i in 1..=6 {
            let t = create_task(
                &conn,
                CreateTaskInput {
                    title: format!("Tâche {}", i),
                    notes: Some(format!("Note {}", i)),
                    category_id: Some("cat-projets".to_string()),
                    priority: Some(i % 4),
                    due_date: Some("2026-11-02".to_string()),
                    estimated_minutes: Some(30),
                    ..Default::default()
                },
            )
            .expect("création tâche");
            created_ids.push(t.id);
        }

        let all_tasks = query_active_tasks(&conn).expect("liste tâches");
        assert_eq!(all_tasks.len(), 6);

        // Ajouter 5 tâches au Focus du jour
        for id in created_ids.iter().take(5) {
            add_focus_item(&conn, "2026-11-02", id).expect("ajout focus 1..5");
        }

        // Un doublon est refusé
        assert!(add_focus_item(&conn, "2026-11-02", &created_ids[0]).is_err());

        // Le 6e ajout est refusé [FOC-1]
        assert!(add_focus_item(&conn, "2026-11-02", &created_ids[5]).is_err());

        // Compléter la tâche 1 met à jour son statut et l'issue Focus [FOC-2]
        let completed = complete_task(&conn, &created_ids[0], true).expect("compléter tâche 1");
        assert_eq!(completed.status, "done");
        assert!(completed.completed_at.is_some());

        let focus_list = query_focus_items_by_day(&conn, "2026-11-02").expect("liste focus");
        assert_eq!(focus_list.len(), 5);
        assert_eq!(focus_list[0].outcome.as_deref(), Some("completed"));

        // Retirer la tâche 2 du Focus et vérifier la renumérotation 1..4
        remove_focus_item(&conn, "2026-11-02", &created_ids[1]).expect("retrait focus");
        let after_remove = query_focus_items_by_day(&conn, "2026-11-02").expect("liste focus");
        assert_eq!(after_remove.len(), 4);
        let positions: Vec<i64> = after_remove.iter().map(|f| f.position).collect();
        assert_eq!(positions, vec![1, 2, 3, 4]);

        // Réordonner le Focus
        let reversed: Vec<String> = after_remove
            .iter()
            .rev()
            .map(|f| f.task_id.clone())
            .collect();
        let reordered =
            reorder_focus_items(&conn, "2026-11-02", &reversed).expect("réordonner focus");
        assert_eq!(reordered[0].task_id, reversed[0]);
        assert_eq!(reordered[0].position, 1);

        // Supprimer et restaurer une tâche (Ctrl+Z [TSK-5])
        delete_task(&conn, &created_ids[5]).expect("suppression tâche 6");
        assert_eq!(query_active_tasks(&conn).expect("tâches actives").len(), 5);

        restore_task(&conn, &created_ids[5]).expect("restauration tâche 6");
        assert_eq!(query_active_tasks(&conn).expect("tâches actives").len(), 6);
    }

    #[test]
    fn test_purge_expired_soft_deleted_over_30_days() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        conn.execute(
            "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, deleted_at, device_id)
             VALUES
                ('task-old-del', 'Vieille tâche supprimée', 'cat-inbox', 'todo', 0, '2026-09-01T00:00:00Z', '2026-09-27T12:00:00Z', '2026-09-27T12:00:00Z', 'dev-1'),
                ('task-recent-del', 'Tâche supprimée récemment', 'cat-inbox', 'todo', 0, '2026-10-01T00:00:00Z', '2026-10-22T12:00:00Z', '2026-10-22T12:00:00Z', 'dev-1'),
                ('task-active', 'Tâche active', 'cat-inbox', 'todo', 0, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', NULL, 'dev-1')",
            [],
        )
        .expect("insertion tâches test purge");

        conn.execute(
            "INSERT INTO launcher_items (id, label, item_type, target, created_at, updated_at, deleted_at, device_id)
             VALUES ('lnc-old-del', 'Ancien lien', 'url', 'https://example.com', '2026-09-01T00:00:00Z', '2026-09-25T00:00:00Z', '2026-09-25T00:00:00Z', 'dev-1')",
            [],
        )
        .expect("insertion launcher test purge");

        conn.execute(
            "INSERT INTO commands (id, label, action_type, action_target, created_at, updated_at, deleted_at, device_id)
             VALUES ('cmd-old-del', 'Ancienne commande', 'capture_template', 'capture', '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z', 'dev-1')",
            [],
        )
        .expect("insertion command test purge");

        let report = purge_expired_soft_deleted_at(&conn, "2026-11-01T12:00:00Z")
            .expect("exécution de la purge > 30j");

        assert_eq!(report.tasks_purged, 1);
        assert_eq!(report.launcher_items_purged, 1);
        assert_eq!(report.commands_purged, 1);
        assert_eq!(report.total_purged, 3);
    }

    #[test]
    fn test_settings_read_and_write() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let all = query_all_settings(&conn).expect("lecture de tous les settings");
        assert!(all.len() >= 9);

        let updated_theme =
            upsert_setting(&conn, "theme", "\"dark\"").expect("mise à jour du thème");
        assert_eq!(updated_theme.value_json, "\"dark\"");

        let invalid_theme = upsert_setting(&conn, "theme", "\"neon\"");
        assert!(
            invalid_theme.is_err(),
            "Un thème hors light|dark|system doit être rejeté"
        );

        let updated_name =
            upsert_setting(&conn, "user_name", "\"Selasi\"").expect("mise à jour user_name");
        assert_eq!(updated_name.value_json, "\"Selasi\"");

        let updated_date_format = upsert_setting(&conn, "date_format", "\"YYYY-MM-DD\"")
            .expect("mise à jour date_format");
        assert_eq!(updated_date_format.value_json, "\"YYYY-MM-DD\"");

        let invalid_date_format = upsert_setting(&conn, "date_format", "\"YYYY/MM/DD\"");
        assert!(
            invalid_date_format.is_err(),
            "Un format de date hors DD-MM-YYYY|MM-DD-YYYY|YYYY-MM-DD doit être rejeté"
        );

        let updated_collapsed =
            upsert_setting(&conn, "quick_capture_panel_collapsed", "true")
                .expect("mise à jour quick_capture_panel_collapsed");
        assert_eq!(updated_collapsed.value_json, "true");
    }

    #[test]
    fn test_bkp1_online_backup_and_bkp2_rotation_7_daily_4_weekly() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        // Configurer un dossier de sauvegarde personnalisé [BKP-2]
        let custom_backup_dir = tmp_dir.path().join("custom_user_backups");
        let custom_dir_json =
            serde_json::to_string(&custom_backup_dir.to_string_lossy().to_string()).unwrap();
        upsert_setting(&conn, "backup_dir", &custom_dir_json).expect("set backup_dir");

        assert_eq!(resolve_backup_dir(&conn, &db_path), custom_backup_dir);

        // Créer une tâche témoin pour vérifier l'intégrité SQLite des backups en ligne [BKP-1]
        let task = create_task(
            &conn,
            CreateTaskInput {
                title: "Tâche sauvegardée en ligne".to_string(),
                priority: Some(3),
                ..Default::default()
            },
        )
        .expect("création tâche");

        // Simuler 10 jours consécutifs de sauvegardes quotidiennes + 6 semaines distinctes
        // Semaines 40 à 44 (5 semaines) + 10 jours dans les semaines 44-45
        let simulated_dates = [
            "2026-09-28T10:00:00Z", // 2026-W40
            "2026-10-05T10:00:00Z", // 2026-W41
            "2026-10-12T10:00:00Z", // 2026-W42
            "2026-10-19T10:00:00Z", // 2026-W43
            "2026-10-26T10:00:00Z", // 2026-W44 (jour 5)
            "2026-10-27T10:00:00Z", // 2026-W44 (jour 6)
            "2026-10-28T10:00:00Z", // 2026-W44 (jour 7)
            "2026-10-29T10:00:00Z", // 2026-W44 (jour 8)
            "2026-10-30T10:00:00Z", // 2026-W44 (jour 9)
            "2026-11-02T10:00:00Z", // 2026-W45 (jour 10, 6e semaine)
        ];

        for iso in simulated_dates {
            let dt = chrono::DateTime::parse_from_rfc3339(iso)
                .expect("date rfc3339 valide")
                .with_timezone(&Utc);
            let report =
                run_scheduled_or_exit_backup(&conn, &db_path, dt, false).expect("backup auto");
            assert!(report.performed);
        }

        // Un second appel le même jour avec force = false ne refait pas la sauvegarde inutilement
        let last_dt = chrono::DateTime::parse_from_rfc3339("2026-11-02T18:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let skip_report =
            run_scheduled_or_exit_backup(&conn, &db_path, last_dt, false).expect("skip backup");
        assert!(!skip_report.performed);

        // En revanche, avec force = true (ex: fermeture de l'application), la sauvegarde est exécutée
        let exit_report =
            run_scheduled_or_exit_backup(&conn, &db_path, last_dt, true).expect("exit backup");
        assert!(exit_report.performed);
        assert_eq!(exit_report.rotation.daily_kept, 7);
        assert_eq!(exit_report.rotation.weekly_kept, 4);

        let listed = list_backup_files(&conn, &db_path).expect("liste des backups");
        let dailies: Vec<&BackupFileInfo> = listed.iter().filter(|b| b.kind == "daily").collect();
        let weeklies: Vec<&BackupFileInfo> = listed.iter().filter(|b| b.kind == "weekly").collect();

        assert_eq!(
            dailies.len(),
            7,
            "La rotation doit conserver exactement 7 sauvegardes quotidiennes [BKP-2]"
        );
        assert_eq!(
            weeklies.len(),
            4,
            "La rotation doit conserver exactement 4 sauvegardes hebdomadaires [BKP-2]"
        );

        // Vérifier que les fichiers conservés sont bien les plus récents
        assert_eq!(dailies[0].filename, "daily-2026-11-02.db");
        assert_eq!(weeklies[0].filename, "weekly-2026-W45.db");

        // Vérifier que la sauvegarde en ligne SQLite est une base valide contenant la tâche créée
        let latest_daily_conn =
            Connection::open(&dailies[0].path).expect("ouverture de la sauvegarde quotidienne");
        let backed_up_task = get_task_by_id(&latest_daily_conn, &task.id)
            .expect("lecture tâche dans backup")
            .expect("tâche présente dans backup");
        assert_eq!(backed_up_task.title, "Tâche sauvegardée en ligne");
    }

    #[test]
    fn test_bkp3_full_json_export_and_reimport_validation() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let cat = create_category(
            &conn,
            CreateCategoryInput {
                name: "Recherche".to_string(),
                alias: Some("rech".to_string()),
                color: Some("--cat-2".to_string()),
                position: Some(10),
            },
        )
        .expect("création catégorie");

        let t1 = create_task(
            &conn,
            CreateTaskInput {
                title: "Lire article distribué".to_string(),
                notes: Some("Section consensus".to_string()),
                category_id: Some(cat.id.clone()),
                priority: Some(2),
                due_date: Some("2026-11-05".to_string()),
                estimated_minutes: Some(45),
                ..Default::default()
            },
        )
        .expect("création tâche");

        add_focus_item(&conn, "2026-11-05", &t1.id).expect("ajout focus");

        conn.execute(
            "INSERT INTO calendar_sources (id, name, source_type, location_or_keychain_ref, refresh_interval_minutes, created_at, updated_at)
             VALUES ('src-1', 'Calendrier Univ', 'file', '/tmp/univ.ics', 30, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')",
            [],
        )
        .expect("insertion source calendrier");

        conn.execute(
            "INSERT INTO calendar_events (id, source_id, ics_uid, title, start_at, end_at, is_all_day, location, notes, rrule, exdates_json)
             VALUES ('evt-1', 'src-1', 'uid-123', 'Cours Architecture', '2026-11-05T08:00:00Z', '2026-11-05T10:00:00Z', 0, 'Amphi A', 'Notes', NULL, '[]')",
            [],
        )
        .expect("insertion événement calendrier");

        conn.execute(
            "INSERT INTO launcher_items (id, label, item_type, target, icon, is_pinned, group_name, position, created_at, updated_at, device_id)
             VALUES ('lnc-1', 'Obsidian', 'uri_scheme', 'obsidian://open', 'book', 1, 'Notes', 1, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', 'local-device')",
            [],
        )
        .expect("insertion launcher item");

        conn.execute(
            "INSERT INTO commands (id, label, alias, action_type, action_target, template_text, shortcut, created_at, updated_at, device_id)
             VALUES ('cmd-1', 'Modèle Sport', 'sp', 'capture_template', 'capture', 'Séance #sport @auj ~1h', NULL, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', 'local-device')",
            [],
        )
        .expect("insertion commande");

        let json_str = export_full_database_pretty_json(&conn).expect("export JSON complet");
        assert!(json_str.contains("\"productivity-dashboard-backup-v1\""));

        let parsed = parse_full_database_json(&json_str).expect("JSON 100 % réimportable");
        assert_eq!(parsed.format, EXPORT_FORMAT_V1);
        assert_eq!(parsed.schema_version, 4);
        assert_eq!(parsed.categories.len(), 6); // 5 par défaut + Recherche
        assert_eq!(parsed.tasks.len(), 1);
        assert_eq!(parsed.tasks[0].title, "Lire article distribué");
        assert_eq!(parsed.focus_items.len(), 1);
        assert_eq!(parsed.calendar_sources.len(), 1);
        assert_eq!(parsed.calendar_events.len(), 1);
        assert_eq!(parsed.launcher_items.len(), 1);
        assert_eq!(parsed.commands.len(), 1);
        assert!(!parsed.settings.is_empty());
    }

    #[test]
    fn test_foc3_uncompleted_past_focus_items_never_auto_copied() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let t_done = create_task(
            &conn,
            CreateTaskInput {
                title: "Tâche d'hier terminée".to_string(),
                ..Default::default()
            },
        )
        .unwrap();
        let t_uncompleted = create_task(
            &conn,
            CreateTaskInput {
                title: "Tâche d'hier non terminée".to_string(),
                ..Default::default()
            },
        )
        .unwrap();
        let t_today = create_task(
            &conn,
            CreateTaskInput {
                title: "Tâche d'aujourd'hui".to_string(),
                ..Default::default()
            },
        )
        .unwrap();

        add_focus_item(&conn, "2026-11-01", &t_done.id).unwrap();
        add_focus_item(&conn, "2026-11-01", &t_uncompleted.id).unwrap();
        complete_task(&conn, &t_done.id, true).unwrap();

        add_focus_item(&conn, "2026-11-02", &t_today.id).unwrap();

        // Vérifier que la tâche non terminée d'hier n'est JAMAIS copiée automatiquement dans 2026-11-02 [FOC-3]
        let today_focus = query_focus_items_by_day(&conn, "2026-11-02").unwrap();
        assert_eq!(today_focus.len(), 1);
        assert_eq!(today_focus[0].task_id, t_today.id);

        // Vérifier que query_uncompleted_past_focus_items retourne uniquement la tâche non terminée des jours passés
        let past_uncompleted =
            query_uncompleted_past_focus_items(&conn, "2026-11-02").expect("requête FOC-3");
        assert_eq!(past_uncompleted.len(), 1);
        assert_eq!(past_uncompleted[0].task_id, t_uncompleted.id);
        assert_eq!(past_uncompleted[0].focus_day, "2026-11-01");
    }
}
