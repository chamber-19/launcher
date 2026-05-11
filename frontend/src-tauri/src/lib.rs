// Launcher — Desktop shell for Chamber-19 apps
// Handles: Tauri/Rust infrastructure, activation, updates, backend lifecycle

mod activation;
mod backend_manager;
mod launcher_updater;

use backend_manager::BackendProcesses;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcesses(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            activation::get_hardware_fingerprint,
            activation::request_activation_pin,
            activation::activate_machine,
            activation::validate_activation_token,
            backend_manager::get_backend_status,
            backend_manager::launch_backend,
            launcher_updater::check_launcher_update,
            launcher_updater::apply_launcher_update,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
