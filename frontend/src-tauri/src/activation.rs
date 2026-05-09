// Activation commands for launcher
// Wraps desktop-toolkit activation logic

use std::collections::HashMap;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct HardwareFingerprint {
    pub hostname: String,
    pub sid: String,
    pub mac_address: String,
    pub hash: String,
}

/// Get hardware fingerprint for this machine
/// Combines: hostname + Windows SID + primary MAC address
#[tauri::command]
pub fn get_hardware_fingerprint() -> Result<HardwareFingerprint, String> {
    // Get hostname
    let hostname = hostname::get()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    // Get Windows SID (using WinAPI)
    let sid = get_windows_sid().unwrap_or_else(|_| "unknown".to_string());

    // Get primary MAC address
    let mac_address = get_primary_mac_address().unwrap_or_else(|_| "unknown".to_string());

    // Hash the combined fingerprint
    use sha2::{Sha256, Digest};
    let combined = format!("{}|{}|{}", hostname, sid, mac_address);
    let hash = format!("{:x}", Sha256::digest(combined.as_bytes()));

    Ok(HardwareFingerprint {
        hostname,
        sid,
        mac_address,
        hash,
    })
}

/// Request activation PIN from server (office network only)
#[tauri::command]
async fn request_activation_pin(backend_url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/api/enrollment/request-pin", backend_url))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to request PIN: {}", error_text));
    }

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let pin = data["pin"]
        .as_str()
        .ok_or("No PIN in response")?
        .to_string();

    Ok(pin)
}

/// Activate machine with PIN + hardware fingerprint
#[tauri::command]
async fn activate_machine(
    backend_url: String,
    pin: String,
    hardware_fingerprint: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let payload = serde_json::json!({
        "pin": pin,
        "hardware_fingerprint": hardware_fingerprint,
    });

    let response = client
        .post(format!("{}/api/enrollment/activate", backend_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Activation failed: {}", error_text));
    }

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let token = data["token"]
        .as_str()
        .ok_or("No token in response")?
        .to_string();

    Ok(token)
}

/// Validate existing activation token
#[tauri::command]
async fn validate_activation_token(
    backend_url: String,
    hardware_fingerprint: String,
    token: String,
) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/api/activation/validate-token", backend_url))
        .form(&[
            ("hardware_fingerprint", hardware_fingerprint.as_str()),
            ("token", token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(response.status().is_success())
}

// ─── Windows-specific helpers ────────────────────────────────

#[cfg(target_os = "windows")]
fn get_windows_sid() -> Result<String, String> {
    // This would require Windows API calls via winapi crate
    // Simplified for now; in production use proper WinAPI bindings
    Ok("sid-placeholder".to_string())
}

#[cfg(not(target_os = "windows"))]
fn get_windows_sid() -> Result<String, String> {
    Err("Windows only".to_string())
}

#[cfg(target_os = "windows")]
fn get_primary_mac_address() -> Result<String, String> {
    // This would require network interface enumeration
    // Could use pnet or similar crate
    Ok("mac-placeholder".to_string())
}

#[cfg(not(target_os = "windows"))]
fn get_primary_mac_address() -> Result<String, String> {
    Err("Windows only".to_string())
}
