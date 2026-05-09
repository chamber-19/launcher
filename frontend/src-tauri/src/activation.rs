// Activation commands for launcher
// Wraps desktop-toolkit activation logic
#[cfg(target_os = "windows")]
use std::process::Command;

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
    let sid = get_windows_sid()?;

    // Get primary MAC address
    let mac_address = get_primary_mac_address()?;

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
pub async fn request_activation_pin(backend_url: String) -> Result<String, String> {
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
pub async fn activate_machine(
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
pub async fn validate_activation_token(
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
    // `whoami /user /fo csv /nh` emits: "USERNAME","SID"
    let output = Command::new("whoami")
        .args(["/user", "/fo", "csv", "/nh"])
        .output()
        .map_err(|e| format!("Failed to run whoami: {e}"))?;

    if !output.status.success() {
        return Err("Unable to read Windows SID".to_string());
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 from whoami output: {e}"))?;
    let line = stdout
        .lines()
        .find(|l| !l.trim().is_empty())
        .ok_or("No SID output returned")?;

    let parts: Vec<&str> = line.split(',').collect();
    if parts.len() < 2 {
        return Err("Unexpected whoami CSV format".to_string());
    }

    let sid = parts[1].trim().trim_matches('"').to_string();
    if sid.is_empty() {
        return Err("Resolved SID was empty".to_string());
    }

    Ok(sid)
}

#[cfg(not(target_os = "windows"))]
fn get_windows_sid() -> Result<String, String> {
    Err("Windows only".to_string())
}

#[cfg(target_os = "windows")]
fn get_primary_mac_address() -> Result<String, String> {
    // `getmac /fo csv /nh` emits rows: "MAC","Transport Name","Media State"
    let output = Command::new("getmac")
        .args(["/fo", "csv", "/nh"])
        .output()
        .map_err(|e| format!("Failed to run getmac: {e}"))?;

    if !output.status.success() {
        return Err("Unable to read MAC address".to_string());
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 from getmac output: {e}"))?;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split(',').collect();
        if parts.is_empty() {
            continue;
        }

        let mac = parts[0].trim().trim_matches('"').to_string();
        if !mac.is_empty() && mac != "N/A" {
            return Ok(mac);
        }
    }

    Err("No valid MAC address found".to_string())
}

#[cfg(not(target_os = "windows"))]
fn get_primary_mac_address() -> Result<String, String> {
    Err("Windows only".to_string())
}
