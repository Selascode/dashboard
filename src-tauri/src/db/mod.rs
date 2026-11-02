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
            2
        );

        verify_schema_integrity(&conn).expect("intégrité du schéma valide");

        // Vérifier les clés settings du LOT A.1
        let theme = query_setting(&conn, "theme")
            .expect("lecture theme")
            .expect("theme existe");
        assert!(matches!(
            theme.value_json.as_str(),
            "\"system\"" | "\"light\"" | "\"dark\""
        ));

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

        let (mut conn, _) = initialize_database(&db_path).expect("init v2");

        let backups_dir = tmp_dir.path().join("backups");
        assert!(backups_dir.exists(), "Le dossier backups/ doit exister");

        conn.execute(
            "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, device_id)
             VALUES ('task-before-v3', 'Tâche avant migration v3', 'cat-inbox', 'todo', 2, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', 'dev-1')",
            [],
        )
        .expect("insertion tâche v2");

        let migrations_v3: &[(i64, &str, &str)] = &[
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
                "003_test_setting.sql",
                "INSERT INTO settings (key, value_json, updated_at) VALUES ('migration_v3_flag', 'true', '2026-11-01T12:00:00Z');",
            ),
        ];

        let created_backups = apply_migrations_with_list(&mut conn, Some(&db_path), migrations_v3)
            .expect("application migration v3 avec backup");

        assert_eq!(created_backups.len(), 1);
        let backup_path = &created_backups[0];
        assert!(backup_path.exists());

        let backup_conn = Connection::open(backup_path).expect("ouverture du backup SQLite");
        let backup_version = get_current_schema_version(&backup_conn).expect("version backup");
        assert_eq!(backup_version, 2);

        let task_title: String = backup_conn
            .query_row(
                "SELECT title FROM tasks WHERE id = 'task-before-v3'",
                [],
                |r| r.get(0),
            )
            .expect("tâche présente dans le backup");
        assert_eq!(task_title, "Tâche avant migration v3");

        let v3_setting =
            query_setting(&backup_conn, "migration_v3_flag").expect("lecture setting backup");
        assert!(v3_setting.is_none());
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
    }
}
