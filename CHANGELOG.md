# Changelog

All notable changes to Launcher are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Universal desktop shell for all Chamber 19 tools**
  - Activation gate (office IP gating, PIN validation, hardware fingerprinting)
  - App router and backend discovery
  - Desktop integration (Windows registry, shortcuts, file associations)
  - Updater orchestration and binary signing

- **Multi-backend support** — launcher now routes to multiple backend HTTP services:
  - Batch Find & Replace (batch text replacement in DWG files)
  - Drawing List Manager (project drawing register management)
  - Transmittal Builder (document package generation)
  - Additional backends can be registered via `VITE_*_URL` environment variables

- Tauri Rust commands for activation in `src-tauri/src/activation.rs`:
  - `get_hardware_fingerprint()` — collect machine hardware
  - `request_activation_pin()` — call toolkit activation server
  - `activate_machine()` — activate with PIN + hardware binding
  - `validate_activation_token()` — startup token validation

- React ActivationGate component in `src/ActivationGate.jsx`:
  - PIN entry UI
  - Token storage in browser localStorage
  - Hardware binding validation

- App.jsx with startup activation check and app routing

- Dependencies: `reqwest`, `sha2`, `hostname` for hardware fingerprinting

### Changed

- Consumer apps no longer need Tauri/React code; launcher handles all UI
- Backend services register as HTTP endpoints; launcher routes to them
- Launcher frontend now attaches `Authorization: Bearer <activation_token>` to
  backend startup/probe calls via `withActivationHeaders()`.
- Launcher startup now fails fast in activation-enforced builds when activation
  token state is missing.
- Launcher now treats backend `401` responses as a hard auth failure,
  clears local activation state, and routes users back to re-activation.

### Tests

- Frontend auth utility `src/activationAuth.js` for token lookup,
  authorization header wiring, and activation-state clearing.
- Launcher E2E coverage in `src/App.e2e.test.jsx` for
  activate -> protected access -> forced re-activation on `401`.

---

## [0.2.0] — 2026-05-10

### Changed

- Rename Cargo crate `shopvac` -> `launcher` throughout (`Cargo.toml`, `main.rs`, `tauri.conf.json`, `package.json`, `package-lock.json`, docs, and scripts).
- Add `frontend/src-tauri/backends.json` baked into the binary via `include_str!`, listing managed backends with `id`, `repo`, `exe_name`, `port`, and `pinned_version`.
- Add `src/backend_manager.rs`: downloads pinned backend executables from GitHub Releases tags, caches in AppData, spawns subprocesses, and exposes `get_backend_status` and `launch_backend` commands.
- Add `src/launcher_updater.rs`: checks `chamber-19/launcher` releases at startup, downloads NSIS installer to temp, runs detached silent install (`/S`), and exits; fails open if GitHub is unreachable.
- Add `UpdateGate` in `App.jsx` to block the main UI until launcher is current; fails open on network error.
- Register `BackendProcesses` managed state and new Tauri commands in `lib.rs`.
- Add `.github/workflows/backend-released.yml`: handles `repository_dispatch` from backend repos, bumps `backends.json` pin and launcher patch version in version files, commits to `main`, and pushes tag using `RELEASE_BOT_PAT`.
- Add `.github/workflows/cut-release.yml`: manual workflow for bump type or explicit version input; updates version files, commits, tags, and pushes.
- Remove `scripts/publish-to-drive.ps1` and `scripts/generate-latest-json.mjs`.
- Remove `latest.json` generation/upload from release workflow.
- Rewrite `RELEASING.md` and `docs/AUTO_UPDATER.md` for GitHub Releases distribution.
- Update `TROUBLESHOOTING.md`, `CONTRIBUTING.md`, and `.github/copilot-instructions.md` to remove `G:\` references and document required release automation secrets.

### Added

- Distribution automation prerequisites:
  - `RELEASE_BOT_PAT` (launcher repo): PAT with repo scope used by release automation workflows.
  - `LAUNCHER_DISPATCH_TOKEN` (Transmittal-Builder repo): PAT used to dispatch `backend-released` events to launcher.
