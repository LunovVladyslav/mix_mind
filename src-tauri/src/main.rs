// MixMind Tauri Backend — main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod audio;
mod ai;
mod commands;
mod config;
mod state;

use std::sync::Arc;
use tokio::sync::Mutex;

use state::AppState;

#[tokio::main]
async fn main() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    ).init();

    let app_state = Arc::new(Mutex::new(AppState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();

            let cfg = config::load_config();
            log::info!("Config loaded: model={}", cfg.api.model);

            // Spawn the bridge polling loop (60Hz shared memory reader)
            tokio::spawn(async move {
                bridge::polling_loop(handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_channels,
            commands::is_bridge_connected,
            commands::analyze_file,
            commands::cancel_analysis,
            commands::send_message,
            commands::clear_history,
            commands::get_config,
            commands::save_config,
            commands::scan_plugins,
            commands::apply_plugin_parameters,
            commands::trigger_preview,
            commands::get_preview_path,
            commands::start_daw_capture,
            commands::stop_daw_capture,
            commands::generate_chat_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
