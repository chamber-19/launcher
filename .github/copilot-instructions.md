# Copilot Instructions — Launcher

> **Repo:** `chamber-19/launcher`
> **Role:** Universal Tauri desktop shell for Chamber 19 tools.
> Handles: App activation, routing, updates, and desktop integration.

Use the shared Chamber 19 conventions from `chamber-19/.github` as reference
guidance, but treat this file as the repo-specific source of truth.

## Current Shape

- `frontend/` contains the Tauri shell, React UI, and activation gate.
- Stack: Tauri v2, React, Vite, Rust, `@chamber-19/desktop-toolkit`.
- Activation flow: office IP gating → PIN request → hardware fingerprinting → token storage.
- App routing: launcher detects activation, shows ActivationGate if needed, then routes to configured backends.
- All backends are HTTP services running on localhost or remote hosts.

## Build And Test

```text
cd frontend

# GitHub Packages auth required
export NODE_AUTH_TOKEN=ghp_yourTokenHere

npm ci
npm run build

cd src-tauri
cargo check
```

## Activation Service

- PIN generation and validation: `desktop-toolkit` FastAPI service
- Office IP gating: configured via `ACTIVATION_OFFICE_IP_RANGES` env var
- Hardware fingerprinting: Tauri Rust commands in `src-tauri/src/activation.rs`
- Token storage: Windows Credential Manager (DPAPI-encrypted)
- Token signing: HMAC-SHA256 with hardware binding

## Dependency Contract

- Keep `frontend/package.json`, `frontend/src-tauri/Cargo.toml`, and
  `frontend/src-tauri/tauri.conf.json` app versions aligned.
- Toolkit bumps must update both `@chamber-19/desktop-toolkit` and the Rust
  `desktop-toolkit` git tag in the same PR, with both lockfiles refreshed.
- Toolkit pin bumps are manual review PRs. Dependabot must not bump them alone.

## Review-Critical Rules

- Activation logic is **not** duplicated here; it consumes `desktop-toolkit` APIs.
- Do not add app-specific business logic to launcher; route via HTTP to backends.
- All backend URLs are configured (not hardcoded) and can be local or remote.
- No remote plugin catalog before explicit feature scope.
- No runtime IPC/control into AutoCAD; launcher manages files and startup only.
- GitHub Releases are the source for released artifacts.
- Update `CHANGELOG.md`, `RELEASING.md`, `TROUBLESHOOTING.md`, or `README.md`
  whenever behavior, release flow, or user-facing docs change.

Path-specific rules live under `.github/instructions/`.
