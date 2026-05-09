// Launcher — Desktop shell for Chamber-19 apps
// Handles: Tauri/Rust infrastructure, activation, updates, IPC routing

mod activation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            activation::get_hardware_fingerprint,
            activation::request_activation_pin,
            activation::activate_machine,
            activation::validate_activation_token,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
