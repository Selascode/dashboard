use chrono::Utc;
use rusqlite::{backup::Backup, params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use thiserror::Error;

pub const MIGRATIONS: &[(i64, &str, &str)] = &[(
    1,
    "001_init.sql",
    include_str!("../../migrations/001_init.sql"),
)];

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

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Erreur SQLite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Erreur d'entrée/sortie: {0}")]
    Io(#[from] std::io::Error),
    #[error("Intégrité du schéma invalide: {0}")]
    SchemaIntegrity(String),
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

pub fn query_active_categories(conn: &Connection) -> Result<Vec<Category>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, alias, color, position, is_system, created_at, updated_at, deleted_at, device_id
         FROM categories
         WHERE deleted_at IS NULL
         ORDER BY position ASC",
    )?;
    let categories = stmt
        .query_map([], |row| {
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
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(categories)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_001_init_migration_and_sync_columns() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");

        let (conn, purge_report) =
            initialize_database(&db_path).expect("initialisation de la base SQLite");

        assert_eq!(purge_report.total_purged, 0);
        assert_eq!(
            get_current_schema_version(&conn).expect("version du schéma"),
            1
        );

        verify_schema_integrity(&conn).expect("intégrité du schéma valide");
    }

    #[test]
    fn test_pre_migration_online_backup() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");

        let (mut conn, _) = initialize_database(&db_path).expect("init v1");

        let backups_dir = tmp_dir.path().join("backups");
        assert!(backups_dir.exists(), "Le dossier backups/ doit exister");

        conn.execute(
            "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, device_id)
             VALUES ('task-before-v2', 'Tâche avant migration v2', 'cat-inbox', 'todo', 2, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', 'dev-1')",
            [],
        )
        .expect("insertion tâche v1");

        let migrations_v2: &[(i64, &str, &str)] = &[
            (
                1,
                "001_init.sql",
                include_str!("../../migrations/001_init.sql"),
            ),
            (
                2,
                "002_test_setting.sql",
                "INSERT INTO settings (key, value_json, updated_at) VALUES ('migration_v2_flag', 'true', '2026-11-01T12:00:00Z');",
            ),
        ];

        let created_backups = apply_migrations_with_list(&mut conn, Some(&db_path), migrations_v2)
            .expect("application migration v2 avec backup");

        assert_eq!(created_backups.len(), 1);
        let backup_path = &created_backups[0];
        assert!(backup_path.exists());

        let backup_conn = Connection::open(backup_path).expect("ouverture du backup SQLite");
        let backup_version = get_current_schema_version(&backup_conn).expect("version backup");
        assert_eq!(backup_version, 1);

        let task_title: String = backup_conn
            .query_row(
                "SELECT title FROM tasks WHERE id = 'task-before-v2'",
                [],
                |r| r.get(0),
            )
            .expect("tâche présente dans le backup");
        assert_eq!(task_title, "Tâche avant migration v2");

        let v2_setting =
            query_setting(&backup_conn, "migration_v2_flag").expect("lecture setting backup");
        assert!(v2_setting.is_none());
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

        let physical_delete = conn.execute("DELETE FROM categories WHERE id = 'cat-inbox'", []);
        assert!(
            physical_delete.is_err(),
            "La suppression physique d'Inbox doit échouer"
        );

        let soft_delete = conn.execute(
            "UPDATE categories SET deleted_at = '2026-11-01T12:00:00Z' WHERE id = 'cat-inbox'",
            [],
        );
        assert!(
            soft_delete.is_err(),
            "La suppression logique d'Inbox doit échouer"
        );

        conn.execute(
            "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, device_id)
             VALUES ('task-ecole-1', 'Réviser cours Rust', 'cat-ecole', 'todo', 1, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
            [],
        )
        .expect("création tâche dans École");

        conn.execute(
            "UPDATE categories SET deleted_at = '2026-11-01T09:00:00Z', updated_at = '2026-11-01T09:00:00Z' WHERE id = 'cat-ecole'",
            [],
        )
        .expect("suppression logique de la catégorie École");

        let reassigned_cat: String = conn
            .query_row(
                "SELECT category_id FROM tasks WHERE id = 'task-ecole-1'",
                [],
                |row| row.get(0),
            )
            .expect("lecture tâche réassignée");
        assert_eq!(reassigned_cat, "cat-inbox");
    }

    #[test]
    fn test_focus_5_constraints_foc1() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        for i in 1..=6 {
            conn.execute(
                "INSERT INTO tasks (id, title, category_id, status, priority, created_at, updated_at, device_id)
                 VALUES (?1, ?2, 'cat-inbox', 'todo', 1, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
                params![format!("t-{}", i), format!("Tâche {}", i)],
            )
            .expect("création tâche");
        }

        conn.execute(
            "INSERT INTO focus_items (id, focus_day, task_id, position, created_at, updated_at, device_id)
             VALUES ('f-1', '2026-11-01', 't-1', 1, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
            [],
        )
        .expect("ajout focus 1");

        let duplicate_task = conn.execute(
            "INSERT INTO focus_items (id, focus_day, task_id, position, created_at, updated_at, device_id)
             VALUES ('f-dup', '2026-11-01', 't-1', 2, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
            [],
        );
        assert!(
            duplicate_task.is_err(),
            "Une même tâche ne peut pas apparaître deux fois le même jour dans le Focus"
        );

        for i in 2..=5 {
            conn.execute(
                "INSERT INTO focus_items (id, focus_day, task_id, position, created_at, updated_at, device_id)
                 VALUES (?1, '2026-11-01', ?2, ?3, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
                params![format!("f-{}", i), format!("t-{}", i), i],
            )
            .expect("ajout focus 2..5");
        }

        let sixth_item = conn.execute(
            "INSERT INTO focus_items (id, focus_day, task_id, position, created_at, updated_at, device_id)
             VALUES ('f-6', '2026-11-01', 't-6', 5, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'dev-1')",
            [],
        );
        assert!(
            sixth_item.is_err(),
            "Le 6e élément du Focus du jour doit être bloqué par contrainte SQLite [FOC-1]"
        );

        conn.execute(
            "UPDATE focus_items SET deleted_at = '2026-11-01T09:00:00Z' WHERE id = 'f-5'",
            [],
        )
        .expect("suppression logique f-5");

        conn.execute(
            "INSERT INTO focus_items (id, focus_day, task_id, position, created_at, updated_at, device_id)
             VALUES ('f-6', '2026-11-01', 't-6', 5, '2026-11-01T09:05:00Z', '2026-11-01T09:05:00Z', 'dev-1')",
            [],
        )
        .expect("ajout 5e élément après libération d'une place");
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

        let remaining_tasks: Vec<String> = conn
            .prepare("SELECT id FROM tasks ORDER BY id")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(remaining_tasks, vec!["task-active", "task-recent-del"]);
    }

    #[test]
    fn test_settings_read_and_write() {
        let tmp_dir = TempDir::new().expect("création dossier temporaire");
        let db_path = tmp_dir.path().join("dashboard.db");
        let (conn, _) = initialize_database(&db_path).expect("init db");

        let all = query_all_settings(&conn).expect("lecture de tous les settings");
        assert!(all.len() >= 6);

        let theme = query_setting(&conn, "theme")
            .expect("lecture setting theme")
            .expect("theme existe");
        assert_eq!(theme.value_json, "\"system\"");

        let updated_theme =
            upsert_setting(&conn, "theme", "\"dark\"").expect("mise à jour du thème");
        assert_eq!(updated_theme.value_json, "\"dark\"");

        let reread = query_setting(&conn, "theme")
            .expect("relecture theme")
            .expect("theme existe");
        assert_eq!(reread.value_json, "\"dark\"");

        let custom =
            upsert_setting(&conn, "backup_dir", "\"/tmp/backups\"").expect("insertion setting");
        assert_eq!(custom.key, "backup_dir");
        assert_eq!(custom.value_json, "\"/tmp/backups\"");
    }
}
