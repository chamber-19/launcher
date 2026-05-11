use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

const LAUNCHER_REPO: &str = "chamber-19/launcher";

// ── GitHub API types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

// ── Public response type ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub notes: Option<String>,
    pub download_url: Option<String>,
}

// ── Version comparison ────────────────────────────────────────────────────────

fn parse_semver(v: &str) -> (u32, u32, u32) {
    let s = v.trim_start_matches('v');
    let mut parts = s.splitn(3, '.');
    let major = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let patch = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    (major, minor, patch)
}

fn is_newer(latest: &str, current: &str) -> bool {
    parse_semver(latest) > parse_semver(current)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

async fn fetch_latest(repo: &str) -> Result<GhRelease, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let client = reqwest::Client::builder()
        .user_agent("chamber-19-launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(&url);
    if let Ok(token) = std::env::var("GITHUB_TOKEN") {
        req = req.bearer_auth(token);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned {}", resp.status()));
    }
    resp.json::<GhRelease>().await.map_err(|e| e.to_string())
}

fn find_nsis_installer(assets: &[GhAsset]) -> Option<&GhAsset> {
    assets
        .iter()
        .find(|a| a.name.ends_with("_x64-setup.exe") || a.name.ends_with("-setup.exe"))
}

async fn download_to_temp(url: &str) -> Result<PathBuf, String> {
    let client = reqwest::Client::builder()
        .user_agent("chamber-19-launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(url);
    if let Ok(token) = std::env::var("GITHUB_TOKEN") {
        req = req.bearer_auth(token);
    }

    let bytes = req
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let dest = std::env::temp_dir().join("chamber19-launcher-update.exe");
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_launcher_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = current_version(&app);
    let release = fetch_latest(LAUNCHER_REPO).await?;
    let latest = release.tag_name.trim_start_matches('v').to_string();

    if !is_newer(&latest, &current) {
        return Ok(UpdateInfo {
            update_available: false,
            current_version: current,
            latest_version: latest,
            notes: None,
            download_url: None,
        });
    }

    let asset = find_nsis_installer(&release.assets);
    Ok(UpdateInfo {
        update_available: asset.is_some(),
        current_version: current,
        latest_version: latest,
        notes: release.body,
        download_url: asset.map(|a| a.browser_download_url.clone()),
    })
}

#[tauri::command]
pub async fn apply_launcher_update(app: AppHandle, download_url: String) -> Result<(), String> {
    let installer = download_to_temp(&download_url).await?;

    // Spawn NSIS installer detached so it survives our process exit.
    // /S = silent install. NSIS restarts the app after install completes.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        std::process::Command::new(&installer)
            .arg("/S")
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    return Err("Self-update is Windows-only".to_string());

    app.exit(0);

    #[allow(unreachable_code)]
    Ok(())
}
