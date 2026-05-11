use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

static BACKENDS_JSON: &str = include_str!("../backends.json");

// ── Config types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
struct BackendsConfig {
    backends: Vec<BackendDef>,
}

#[derive(Debug, Clone, Deserialize)]
struct BackendDef {
    id: String,
    repo: String,
    exe_name: String,
    port: u16,
    pinned_version: String,
}

// ── GitHub Releases API types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

// ── Public response types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct BackendStatus {
    pub id: String,
    pub cached_version: Option<String>,
    pub pinned_version: String,
    pub update_available: bool,
    pub latest_version: Option<String>,
    pub running: bool,
    pub port: u16,
}

// ── Process registry ──────────────────────────────────────────────────────────

pub struct BackendProcesses(pub Mutex<Vec<(String, Child)>>);

// ── Paths ─────────────────────────────────────────────────────────────────────

fn backend_cache_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("backends")
}

fn cached_exe_path(app: &AppHandle, def: &BackendDef) -> PathBuf {
    backend_cache_dir(app)
        .join(&def.id)
        .join(&def.pinned_version)
        .join(&def.exe_name)
}

fn cached_version_path(app: &AppHandle, def: &BackendDef) -> PathBuf {
    backend_cache_dir(app).join(&def.id).join("version.txt")
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

async fn fetch_latest_release(repo: &str) -> Result<GhRelease, String> {
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

async fn download_exe(url: &str, dest: &PathBuf) -> Result<(), String> {
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

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Core operations ───────────────────────────────────────────────────────────

pub async fn ensure_backend(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let config: BackendsConfig =
        serde_json::from_str(BACKENDS_JSON).map_err(|e| format!("backends.json parse: {}", e))?;

    let def = config
        .backends
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Unknown backend id: {}", id))?;

    let exe = cached_exe_path(app, def);
    if exe.exists() {
        return Ok(exe);
    }

    // Fetch the specific pinned release tag
    let tag = format!("v{}", def.pinned_version);
    let url = format!(
        "https://api.github.com/repos/{}/releases/tags/{}",
        def.repo, tag
    );
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
        return Err(format!(
            "GitHub API returned {} for release {}",
            resp.status(),
            tag
        ));
    }
    let release: GhRelease = resp.json().await.map_err(|e| e.to_string())?;

    let asset = release
        .assets
        .iter()
        .find(|a| a.name == def.exe_name)
        .ok_or_else(|| {
            format!(
                "Asset '{}' not found in release {}",
                def.exe_name, tag
            )
        })?;

    download_exe(&asset.browser_download_url, &exe).await?;

    // Write version marker
    let ver_path = cached_version_path(app, def);
    if let Some(p) = ver_path.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    let _ = std::fs::write(&ver_path, &def.pinned_version);

    Ok(exe)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_backend_status(app: AppHandle, id: String) -> Result<BackendStatus, String> {
    let config: BackendsConfig =
        serde_json::from_str(BACKENDS_JSON).map_err(|e| format!("backends.json parse: {}", e))?;

    let def = config
        .backends
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Unknown backend id: {}", id))?;

    let ver_path = cached_version_path(&app, def);
    let cached_version = std::fs::read_to_string(&ver_path).ok().map(|s| s.trim().to_string());

    let processes = app
        .state::<BackendProcesses>()
        .0
        .lock()
        .map_err(|e| e.to_string())?;
    let running = processes.iter().any(|(pid, _)| pid == &id);

    // Non-blocking latest version check
    let latest_version = match fetch_latest_release(&def.repo).await {
        Ok(r) => Some(r.tag_name.trim_start_matches('v').to_string()),
        Err(_) => None,
    };

    let update_available = match (&cached_version, &latest_version) {
        (Some(cached), Some(latest)) => cached != latest,
        _ => false,
    };

    Ok(BackendStatus {
        id: def.id.clone(),
        cached_version,
        pinned_version: def.pinned_version.clone(),
        update_available,
        latest_version,
        running,
        port: def.port,
    })
}

#[tauri::command]
pub async fn launch_backend(app: AppHandle, id: String) -> Result<(), String> {
    let exe = ensure_backend(&app, &id).await?;

    let config: BackendsConfig =
        serde_json::from_str(BACKENDS_JSON).map_err(|e| format!("backends.json parse: {}", e))?;
    let def = config
        .backends
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Unknown backend id: {}", id))?;

    // Check if already running
    {
        let processes = app
            .state::<BackendProcesses>()
            .0
            .lock()
            .map_err(|e| e.to_string())?;
        if processes.iter().any(|(pid, _)| pid == &id) {
            return Ok(());
        }
    }

    let child = Command::new(&exe)
        .env("PORT", def.port.to_string())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", exe.display(), e))?;

    app.state::<BackendProcesses>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .push((id, child));

    Ok(())
}
