pub mod db;

use db::{
    add_focus_item as db_add_focus_item, complete_task as db_complete_task,
    create_category as db_create_category, create_task as db_create_task,
    delete_category as db_delete_category, delete_task as db_delete_task,
    get_current_schema_version, initialize_database, query_active_categories, query_active_tasks,
    query_all_settings, query_focus_items_by_day, query_setting,
    remove_focus_item as db_remove_focus_item, reorder_focus_items as db_reorder_focus_items,
    restore_task as db_restore_task, update_category as db_update_category,
    update_task as db_update_task, upsert_setting, verify_schema_integrity, AppDbState, Category,
    CreateCategoryInput, CreateTaskInput, DbStatus, FocusItem, Setting, Task, UpdateCategoryInput,
    UpdateTaskInput, ALL_TABLES, SYNCHRONIZABLE_TABLES,
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
fn list_categories(state: State<'_, AppDbState>) -> Result<Vec<Category>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_active_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_category(
    input: CreateCategoryInput,
    state: State<'_, AppDbState>,
) -> Result<Category, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_create_category(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_category(
    input: UpdateCategoryInput,
    state: State<'_, AppDbState>,
) -> Result<Category, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_update_category(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_category(id: String, state: State<'_, AppDbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_delete_category(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_tasks(state: State<'_, AppDbState>) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_active_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_task(input: CreateTaskInput, state: State<'_, AppDbState>) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_create_task(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task(input: UpdateTaskInput, state: State<'_, AppDbState>) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_update_task(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn complete_task(
    id: String,
    completed: bool,
    state: State<'_, AppDbState>,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_complete_task(&conn, &id, completed).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_task(id: String, state: State<'_, AppDbState>) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_delete_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_task(id: String, state: State<'_, AppDbState>) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_restore_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_focus_items(
    focus_day: String,
    state: State<'_, AppDbState>,
) -> Result<Vec<FocusItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_focus_items_by_day(&conn, &focus_day).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_focus_item(
    focus_day: String,
    task_id: String,
    state: State<'_, AppDbState>,
) -> Result<FocusItem, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_add_focus_item(&conn, &focus_day, &task_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_focus_item(
    focus_day: String,
    task_id: String,
    state: State<'_, AppDbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_remove_focus_item(&conn, &focus_day, &task_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn reorder_focus_items(
    focus_day: String,
    ordered_task_ids: Vec<String>,
    state: State<'_, AppDbState>,
) -> Result<Vec<FocusItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_reorder_focus_items(&conn, &focus_day, &ordered_task_ids).map_err(|e| e.to_string())
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
            list_categories,
            create_category,
            update_category,
            delete_category,
            list_tasks,
            create_task,
            update_task,
            complete_task,
            delete_task,
            restore_task,
            list_focus_items,
            add_focus_item,
            remove_focus_item,
            reorder_focus_items,
            get_db_status,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application Tauri");
}
