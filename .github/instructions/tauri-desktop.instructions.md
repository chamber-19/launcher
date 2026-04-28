---
applyTo: "frontend/**"
---

# Launcher Tauri Instructions

- Keep Tauri, package, and Cargo versions synchronized.
- Build from `frontend/`; `shell/` is not a valid path in this repo yet.
- If a toolkit pin changes, run `npm install` in `frontend/` and
  `cargo update -p desktop-toolkit --manifest-path frontend/src-tauri/Cargo.toml`.
- Do not add plugin source code under this repo. Plugins live in their own repos.
- Installer/update behavior changes require matching docs and changelog updates.
