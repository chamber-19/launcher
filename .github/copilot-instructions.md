# Copilot Instructions — Launcher

> **Repo:** `chamber-19/launcher`
> **Role:** Universal Tauri desktop shell for Chamber 19 tools.
> Handles: App activation, routing, updates, and desktop integration.
>
> **Source of Truth:** See [`chamber-19/.github`](https://github.com/chamber-19/.github) for:
> - Org-wide architecture and SKILLS
> - Hard architectural decisions (Tauri, Python, Rust constraints)
> - Family-wide conventions and AI agent guidance
>
> This file contains **repo-specific guidance only**. Repo-specific rules override
> org-wide rules on conflict.

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
export NODE_AUTH_TOKEN=<YOUR_GITHUB_PACKAGES_TOKEN>

npm ci
npm run build

cd src-tauri
cargo check
```

## Activation Service

- PIN generation and validation: `desktop-toolkit` FastAPI service
- Office IP gating: configured via `ACTIVATION_OFFICE_IP_RANGES` env var
- Hardware fingerprinting: Tauri Rust commands in `src-tauri/src/activation.rs`
- Token storage: browser localStorage in current launcher implementation
- Token signing: HMAC-SHA256 with hardware binding

## Backend Service Configuration

The launcher routes to multiple backend HTTP services. Each backend is configured
via environment variables:

| Backend | Env Variable | Default | Purpose |
| --- | --- | --- | --- |
| Batch Find & Replace | `VITE_BATCH_FNR_URL` | `http://127.0.0.1:8000` | Batch text replacement in DWG files (Python FastAPI) |
| Drawing List Manager | `VITE_DRAWING_LIST_MANAGER_URL` | `http://127.0.0.1:8002` | Project drawing register management (Python FastAPI) |
| Transmittal Builder | `VITE_TRANSMITTAL_BUILDER_URL` | `http://127.0.0.1:8001` | Document package generation (Python FastAPI) |

**Note:** **Block Library** is a separate desktop app (Tauri + Three.js 3D viewer).
It is **not** routed via launcher's HTTP mechanism because 3D rendering requires
GPU memory management and client-side WebGL context. Block Library is installed
separately and launched independently. See [`chamber-19/block-library`](https://github.com/chamber-19/block-library)
for details on its standalone deployment model.

Example `.env` for local development:

```bash
VITE_BATCH_FNR_URL=http://127.0.0.1:8000
VITE_DRAWING_LIST_MANAGER_URL=http://127.0.0.1:8002
VITE_TRANSMITTAL_BUILDER_URL=http://127.0.0.1:8001
LAUNCHER_ENFORCE_PIN=1
```

Each backend must respond to:

- `GET /api/health` — returns `200 OK` with service info (used for startup validation)
- Protected endpoint for token validation (varies by backend):
  - `POST /api/scan-folder` for batch-fnr
  - `GET /api/project/recent` for drawing-list-manager
  - `GET /api/scan-projects` for transmittal-builder

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

## Markdown Formatting Standards

All markdown files in this repo **MUST** be formatted cleanly with no linter warnings:

- **Fenced code blocks** require language specifiers: ` ```python` (not ` ``` `)
- **Headings** must not be duplicated in the same document
- **Lists** must be surrounded by blank lines
- **Line length** should be kept reasonable (80-100 chars preferred, hard wrap at 120)
- Run linter before committing: `npm run lint:md` (if available) or use editor validation

Agent guidance: Any markdown file with linter warnings is treated as technical debt.
Format fixes are low-risk and required. Update all `.md` files before merging PRs.
For new markdown files, validate with editor linter before committing.

## SKILLS and Shared Resources

This repo draws on shared knowledge from [`chamber-19/.github`](https://github.com/chamber-19/.github):

- **SKILLS** — Reusable domain knowledge in `.github/` folder (Tauri, Python, Rust, Markdown, etc.)
- **`copilot-instructions.md`** — Org-wide baseline for all agents
- **Hard architectural decisions** — Closed decisions on Tauri, Python, AutoCAD patterns
- **Desktop app architecture** — Launcher + toolkit + backends model
- **Family conventions** — Shared practices across all repos

**When working in this repo:** Always check `.github` repo first for shared context,
then apply repo-specific rules from this file. Repo-specific rules override org-wide
rules on conflict.

---

Path-specific rules live under `.github/instructions/`.


<!-- Added by chamber-19-skill-sync — required skill references for this repo's stack -->
- Read [`docs/skills/RUST.MD`](https://github.com/chamber-19/.github/blob/main/docs/skills/RUST.MD) before any Rust work.
- Read [`docs/skills/TAURI.MD`](https://github.com/chamber-19/.github/blob/main/docs/skills/TAURI.MD) before any Tauri work.
