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

- Tauri Rust commands for activation in `src-tauri/src/activation.rs`:
  - `get_hardware_fingerprint()` — collect machine hardware
  - `request_activation_pin()` — call toolkit activation server
  - `activate_machine()` — activate with PIN + hardware binding
  - `validate_activation_token()` — periodic token revalidation

- React ActivationGate component in `src/ActivationGate.jsx`:
  - PIN entry UI
  - Token storage in browser localStorage
  - Hardware binding validation

- App.jsx with startup activation check and app routing

- Dependencies: `reqwest`, `sha2`, `hostname` for hardware fingerprinting

### Changed

- Consumer apps no longer need Tauri/React code; launcher handles all UI
- Backend services register as HTTP endpoints; launcher routes to them
