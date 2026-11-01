pub mod db;

use db::{
    get_current_schema_version, initialize_database, query_active_categories, query_all_settings,
    query_setting, upsert_setting, verify_schema_integrity, AppDbState, Category, DbStatus,
    Setting, ALL_TABLES, SYNCHRONIZABLE_TABLES,
};
use std::sync::Mutex;
use tauri::{Manager, State};

#[tauri::command]
fn get_settings(state: State<'_, AppDbState>) -> Result<Vec<Setting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_all_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(key: String, state: State<'_, AppDbState>) -> Result<Option<Setting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(
    key: String,
    value_json: String,
    state: State<'_, AppDbState>,
) -> Result<Setting, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    upsert_setting(&conn, &key, &value_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_categories(state: State<'_, AppDbState>) -> Result<Vec<Category>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_active_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_status(state: State<'_, AppDbState>) -> Result<DbStatus, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    verify_schema_integrity(&conn).map_err(|e| e.to_string())?;
    let schema_version = get_current_schema_version(&conn).map_err(|e| e.to_string())?;

    Ok(DbStatus {
        db_path: state.db_path.to_string_lossy().into_owned(),
        schema_version,
        tables_verified: ALL_TABLES.iter().map(|s| (*s).to_string()).collect(),
        sync_entities_verified: SYNCHRONIZABLE_TABLES
            .iter()
            .map(|s| (*s).to_string())
            .collect(),
        last_purge_report: state.last_purge_report.clone(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db_path = app_data_dir.join("dashboard.db");
            let (conn, last_purge_report) = initialize_database(&db_path)
                .map_err(|e| std::io::Error::other(e.to_string()))?;

            app.manage(AppDbState {
                conn: Mutex::new(conn),
                db_path,
                last_purge_report,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            get_setting,
            set_setting,
            get_categories,
            get_db_status,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application Tauri");
}
