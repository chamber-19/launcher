# Copilot Instructions — Launcher

> **Repo:** `chamber-19/launcher`
> **Role:** Tauri desktop shell for installing, updating, and launching Chamber 19 tools.

Use the shared Chamber 19 conventions from `chamber-19/.github` as reference
guidance, but treat this file as the repo-specific source of truth.

## Current Shape

- The app lives in `frontend/` today. Do **not** use `shell/` paths in this repo
  unless a dedicated rename PR actually performs that migration.
- The product still contains historical `Shopvac` names. Do not rebrand product,
  package, bundle identifier, or docs opportunistically.
- Stack: Tauri v2, React, Vite, Rust, NSIS, `@chamber-19/desktop-toolkit`.

## Build And Test

```text
cd frontend
npm ci
npm run build

cd frontend/src-tauri
cargo check
```

## Dependency Contract

- Keep `frontend/package.json`, `frontend/src-tauri/Cargo.toml`, and
  `frontend/src-tauri/tauri.conf.json` app versions aligned.
- Toolkit bumps must update both `@chamber-19/desktop-toolkit` and the Rust
  `desktop-toolkit` git tag in the same PR, with both lockfiles refreshed.
- Toolkit pin bumps are manual review PRs. Dependabot must not bump them alone.

## Review-Critical Rules

- No remote plugin catalog before a future catalog feature is explicitly scoped.
- No runtime IPC/control path into AutoCAD; launcher manages files and startup
  registration only.
- No silent background update timers in the current line.
- GitHub Releases are the source for released artifacts.
- Update `CHANGELOG.md`, `RELEASING.md`, `TROUBLESHOOTING.md`, or `README.md`
  whenever behavior, release flow, or user-facing docs change.

Path-specific rules live under `.github/instructions/`.
