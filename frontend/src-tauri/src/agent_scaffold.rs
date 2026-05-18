use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

static AGENTS_JSON: &str = include_str!("../agents.json");

#[derive(Debug, Clone, Deserialize)]
struct AgentsConfig {
    schema_version: u32,
    purpose_required: bool,
    mascot_templates: Vec<String>,
    apps: Vec<AppAgentSeed>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppAgentSeed {
    app_id: String,
    display_name: String,
}

#[derive(Debug, Clone, Serialize)]
struct AgentManifestSeed {
    schema_version: u32,
    app_id: String,
    display_name: String,
    purpose_required: bool,
    purpose: String,
    capabilities: Vec<String>,
    mascot_templates: Vec<String>,
    memory_scope: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentScaffoldStatus {
    pub app_id: String,
    pub manifest_path: String,
    pub purpose_doc_path: String,
    pub agents_db_path: String,
    pub memory_db_path: String,
}

fn agent_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("agents"))
}

fn purpose_template(app_name: &str, app_id: &str) -> String {
    format!(
        "# AGENT PURPOSE\n\nApp: {}\nApp ID: {}\n\n## Purpose (required)\n- TODO: Define this agent's primary purpose in one sentence.\n\n## Initial capabilities\n- TODO: List 3-7 concrete capabilities.\n\n## Data boundaries\n- In scope:\n  - TODO\n- Out of scope:\n  - TODO\n\n## Guardrails\n- Per-app memory only.\n- No cross-app memory sharing.\n- Fail open to \"needs human review\" when required services are unavailable.\n",
        app_name, app_id
    )
}

pub fn initialize_agent_scaffolds(app: &AppHandle) -> Result<(), String> {
    let config: AgentsConfig = serde_json::from_str(AGENTS_JSON)
        .map_err(|e| format!("agents.json parse: {}", e))?;

    let root = agent_root(app)?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    for app_seed in config.apps {
        let app_dir = root.join(&app_seed.app_id);
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

        let manifest = AgentManifestSeed {
            schema_version: config.schema_version,
            app_id: app_seed.app_id.clone(),
            display_name: app_seed.display_name.clone(),
            purpose_required: config.purpose_required,
            purpose: String::new(),
            capabilities: Vec::new(),
            mascot_templates: config.mascot_templates.clone(),
            memory_scope: "per-app".to_string(),
        };

        let manifest_path = app_dir.join("agent-manifest.json");
        if !manifest_path.exists() {
            let body = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
            std::fs::write(&manifest_path, body).map_err(|e| e.to_string())?;
        }

        let purpose_doc_path = app_dir.join("AGENT_PURPOSE.md");
        if !purpose_doc_path.exists() {
            std::fs::write(
                &purpose_doc_path,
                purpose_template(&app_seed.display_name, &app_seed.app_id),
            )
            .map_err(|e| e.to_string())?;
        }

        let agents_db_path = app_dir.join(format!("{}.agents.db", app_seed.app_id));
        if !agents_db_path.exists() {
            OpenOptions::new()
                .create(true)
                .write(true)
                .open(&agents_db_path)
                .map_err(|e| e.to_string())?;
        }

        let memory_db_path = app_dir.join(format!("{}.memory.db", app_seed.app_id));
        if !memory_db_path.exists() {
            OpenOptions::new()
                .create(true)
                .write(true)
                .open(&memory_db_path)
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_agent_scaffold_status(app: AppHandle) -> Result<Vec<AgentScaffoldStatus>, String> {
    let config: AgentsConfig = serde_json::from_str(AGENTS_JSON)
        .map_err(|e| format!("agents.json parse: {}", e))?;
    let root = agent_root(&app)?;

    let statuses = config
        .apps
        .into_iter()
        .map(|seed| {
            let app_dir = root.join(&seed.app_id);
            AgentScaffoldStatus {
                app_id: seed.app_id.clone(),
                manifest_path: app_dir.join("agent-manifest.json").display().to_string(),
                purpose_doc_path: app_dir.join("AGENT_PURPOSE.md").display().to_string(),
                agents_db_path: app_dir
                    .join(format!("{}.agents.db", seed.app_id))
                    .display()
                    .to_string(),
                memory_db_path: app_dir
                    .join(format!("{}.memory.db", seed.app_id))
                    .display()
                    .to_string(),
            }
        })
        .collect();

    Ok(statuses)
}
