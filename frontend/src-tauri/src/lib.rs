// Launcher -- Desktop shell for Chamber-19 apps.
// Handles: Tauri/Rust infrastructure, updates, backend lifecycle, and the
// org-shared PIN activation flow (Drive-keyed, owned by desktop-toolkit).

mod agent_scaffold;
mod backend_manager;
mod launcher_updater;

use backend_manager::BackendProcesses;
use desktop_toolkit::activation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcesses(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            activation::commands::toolkit_check_activation,
            activation::commands::toolkit_activate_with_pin,
            activation::commands::toolkit_activation_status,
            activation::commands::toolkit_deactivate,
            activation::commands::toolkit_get_bearer_token,
            agent_scaffold::get_agent_scaffold_status,
            backend_manager::get_backend_status,
            backend_manager::launch_backend,
            launcher_updater::check_launcher_update,
            launcher_updater::apply_launcher_update,
        ])
        .setup(|app| {
            // Create per-app starter agent files on first launch if missing.
            agent_scaffold::initialize_agent_scaffolds(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}