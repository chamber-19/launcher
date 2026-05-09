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
  - Transmittal Builder (document package generation)
  - Batch Find & Replace (batch text replacement in DWG files)
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
