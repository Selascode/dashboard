pub mod db;

use chrono::Utc;
use db::{
    add_focus_item as db_add_focus_item, complete_task as db_complete_task,
    create_calendar_source as db_create_calendar_source, create_category as db_create_category,
    create_task as db_create_task, delete_calendar_source as db_delete_calendar_source,
    delete_category as db_delete_category, delete_task as db_delete_task,
    export_full_database_pretty_json, fetch_calendar_source_ics as db_fetch_calendar_source_ics,
    get_current_schema_version, initialize_database, list_backup_files,
    list_calendar_events as db_list_calendar_events,
    list_calendar_sources as db_list_calendar_sources, query_active_categories,
    query_active_tasks, query_all_settings, query_focus_items_by_day, query_setting,
    query_uncompleted_past_focus_items,
    record_calendar_source_error as db_record_calendar_source_error,
    remove_focus_item as db_remove_focus_item, reorder_focus_items as db_reorder_focus_items,
    restore_task as db_restore_task, run_scheduled_or_exit_backup,
    save_calendar_events_for_source as db_save_calendar_events_for_source,
    update_calendar_source as db_update_calendar_source, update_category as db_update_category,
    update_task as db_update_task, upsert_setting, verify_schema_integrity, AppDbState,
    BackupFileInfo, BackupReport, CalendarEvent, CalendarEventInput, CalendarSource, Category,
    CreateCalendarSourceInput, CreateCategoryInput, CreateTaskInput, DbStatus, FocusItem, Setting,
    Task, UpdateCalendarSourceInput, UpdateCategoryInput, UpdateTaskInput, ALL_TABLES,
    SYNCHRONIZABLE_TABLES,
};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub const DEFAULT_QUICK_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";
pub const QUICK_CAPTURE_CLI_FLAG: &str = "--quick-capture";
pub const QUICK_CAPTURE_OPEN_EVENT: &str = "quick-capture:open";

/// Détecte si l'argument CLI `--quick-capture` est présent (repli natif Wayland / Linux [CAP-1, Section 10]).
pub fn has_quick_capture_flag<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .any(|arg| arg.as_ref().trim() == QUICK_CAPTURE_CLI_FLAG)
}

/// Ramène la fenêtre de capture rapide (ou la fenêtre principale) au premier plan en < 300 ms
/// et émet l'événement `quick-capture:open` vers l'interface React [CAP-1, PRF-1].
pub fn trigger_quick_capture_window(app: &tauri::AppHandle) {
    if let Some(window) = app
        .get_webview_window("quick-capture")
        .or_else(|| app.get_webview_window("main"))
    {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let _ = app.emit(QUICK_CAPTURE_OPEN_EVENT, ());
}

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
fn list_uncompleted_past_focus_items(
    before_focus_day: String,
    state: State<'_, AppDbState>,
) -> Result<Vec<FocusItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    query_uncompleted_past_focus_items(&conn, &before_focus_day).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_calendar_sources(state: State<'_, AppDbState>) -> Result<Vec<CalendarSource>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_list_calendar_sources(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_calendar_source(
    input: CreateCalendarSourceInput,
    state: State<'_, AppDbState>,
) -> Result<CalendarSource, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_create_calendar_source(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_calendar_source(
    input: UpdateCalendarSourceInput,
    state: State<'_, AppDbState>,
) -> Result<CalendarSource, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_update_calendar_source(&conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_calendar_source(id: String, state: State<'_, AppDbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_delete_calendar_source(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn fetch_calendar_source_ics(id: String, state: State<'_, AppDbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_fetch_calendar_source_ics(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_calendar_events_for_source(
    source_id: String,
    events: Vec<CalendarEventInput>,
    state: State<'_, AppDbState>,
) -> Result<Vec<CalendarEvent>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_save_calendar_events_for_source(&conn, &source_id, events).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_calendar_source_error(
    source_id: String,
    error_message: String,
    state: State<'_, AppDbState>,
) -> Result<CalendarSource, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_record_calendar_source_error(&conn, &source_id, &error_message).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_calendar_events(
    source_id: Option<String>,
    state: State<'_, AppDbState>,
) -> Result<Vec<CalendarEvent>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db_list_calendar_events(&conn, source_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn trigger_backup(
    force: Option<bool>,
    state: State<'_, AppDbState>,
) -> Result<BackupReport, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    run_scheduled_or_exit_backup(&conn, &state.db_path, Utc::now(), force.unwrap_or(true))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_backups(state: State<'_, AppDbState>) -> Result<Vec<BackupFileInfo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    list_backup_files(&conn, &state.db_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_backup_dir(backup_dir: String, state: State<'_, AppDbState>) -> Result<Setting, String> {
    let trimmed = backup_dir.trim();
    if !trimmed.is_empty() {
        let dir_path = PathBuf::from(trimmed);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Impossible de créer ou d'accéder au dossier de sauvegarde : {}", e))?;
    }
    let value_json = serde_json::to_string(trimmed).map_err(|e| e.to_string())?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    upsert_setting(&conn, "backup_dir", &value_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_full_json(
    dest_path: Option<String>,
    state: State<'_, AppDbState>,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let json = export_full_database_pretty_json(&conn).map_err(|e| e.to_string())?;
    if let Some(path_str) = dest_path {
        let trimmed = path_str.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if let Some(parent) = path.parent() {
                if !parent.as_os_str().is_empty() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }
            fs::write(&path, &json).map_err(|e| e.to_string())?;
        }
    }
    Ok(json)
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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if has_quick_capture_flag(&argv) {
                trigger_quick_capture_window(app);
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        trigger_quick_capture_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db_path = app_data_dir.join("dashboard.db");
            let (conn, last_purge_report) = initialize_database(&db_path)
                .map_err(|e| std::io::Error::other(e.to_string()))?;

            // Sauvegarde quotidienne automatique au démarrage si elle n'a pas encore eu lieu aujourd'hui [BKP-1, BKP-2].
            if let Err(err) = run_scheduled_or_exit_backup(&conn, &db_path, Utc::now(), false) {
                eprintln!(
                    "[BKP-1] Avertissement lors de la sauvegarde automatique de démarrage : {}",
                    err
                );
            }

            let configured_shortcut = query_setting(&conn, "global_capture_shortcut")
                .ok()
                .flatten()
                .map(|s| s.value_json.trim().trim_matches('"').to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| DEFAULT_QUICK_CAPTURE_SHORTCUT.to_string());

            app.manage(AppDbState {
                conn: Mutex::new(conn),
                db_path,
                last_purge_report,
            });

            // Enregistrement du raccourci global (Windows / macOS / Linux X11 [CAP-1]).
            // Sous Ubuntu Wayland, si le compositeur bloque l'enregistrement global XDG,
            // on journalise un avertissement sans interrompre le démarrage : le repli CLI
            // `--quick-capture` via `tauri-plugin-single-instance` prend alors le relais.
            if let Err(err) = app
                .global_shortcut()
                .register(configured_shortcut.as_str())
            {
                eprintln!(
                    "[CAP-1] Raccourci global '{}' non enregistré sur cette session (Wayland probable) : {}. Utilisez l'argument CLI `{}`.",
                    configured_shortcut, err, QUICK_CAPTURE_CLI_FLAG
                );
            }

            if has_quick_capture_flag(std::env::args()) {
                trigger_quick_capture_window(app.handle());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) && window.label() == "main"
            {
                if let Some(state) = window.app_handle().try_state::<AppDbState>() {
                    if let Ok(conn) = state.conn.lock() {
                        if let Err(err) =
                            run_scheduled_or_exit_backup(&conn, &state.db_path, Utc::now(), true)
                        {
                            eprintln!(
                                "[BKP-1] Avertissement lors de la sauvegarde de fermeture : {}",
                                err
                            );
                        }
                    }
                }
            }
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
            list_uncompleted_past_focus_items,
            list_calendar_sources,
            create_calendar_source,
            update_calendar_source,
            delete_calendar_source,
            fetch_calendar_source_ics,
            save_calendar_events_for_source,
            record_calendar_source_error,
            list_calendar_events,
            trigger_backup,
            list_backups,
            set_backup_dir,
            export_full_json,
            get_db_status,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application Tauri");
}

#[cfg(test)]
mod tests {
    use super::{has_quick_capture_flag, DEFAULT_QUICK_CAPTURE_SHORTCUT, QUICK_CAPTURE_CLI_FLAG};

    #[test]
    fn test_has_quick_capture_flag_detection() {
        assert!(has_quick_capture_flag([
            "productivity-dashboard",
            "--quick-capture"
        ]));
        assert!(has_quick_capture_flag([
            "/usr/bin/productivity-dashboard",
            "--other",
            " --quick-capture "
        ]));
        assert!(!has_quick_capture_flag(["productivity-dashboard"]));
        assert_eq!(QUICK_CAPTURE_CLI_FLAG, "--quick-capture");
        assert_eq!(
            DEFAULT_QUICK_CAPTURE_SHORTCUT,
            "CommandOrControl+Shift+Space"
        );
    }
}
