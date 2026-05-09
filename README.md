# Launcher

The universal desktop shell for Chamber 19 desktop tools. Built on
[`@chamber-19/desktop-toolkit`](https://github.com/chamber-19/desktop-toolkit)
and Tauri v2 / React / Vite.

**What it does:**

- **Activation gate** — Office IP gating, PIN validation, hardware fingerprinting (via `desktop-toolkit` API)
- **App routing** — Detects configured backend services and launches them
- **Desktop integration** — Windows registry, Start menu shortcuts, file associations
- **Updater** — Manages installer downloads, binary signing, rollback
- **Multi-tool support** — One launcher .exe for all Chamber 19 apps; no per-app installers

**Architecture:**

```text
┌─────────────────────────────────────────┐
│ launcher (Tauri + React)                │
│ ├─ Activation gate                      │
│ ├─ App router                           │
│ ├─ Desktop integration                  │
│ └─ Updater                              │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   ┌────▼───┐  ┌─────▼──────────────────────┐
   │desktop-│  │Multiple Backend Services   │
   │toolkit │  │(HTTP services)             │
   │(auth)  │  │├─ Transmittal Builder      │
   └────────┘  │├─ Batch Find & Replace     │
                │└─ Drawing List Manager     │
                └────────────────────────────┘
```

Launcher detects configured backend services and routes users to them after
activation succeeds. Each backend app is a stateless HTTP service.

---

## Repository layout

```text
launcher/
├── frontend/                   Tauri + React desktop app
│   ├── src/                    React components (ActivationGate, App, etc.)
│   ├── src-tauri/              Rust + Tauri config
│   │   └── src/
│   │       ├── main.rs         App init
│   │       ├── lib.rs          Tauri setup
│   │       └── activation.rs   Activation commands (hardware, PIN, token)
│   ├── package.json
│   └── vite.config.js
├── scripts/                    Release automation, version bumps
├── docs/                       Reference documentation
├── .github/
│   ├── copilot-instructions.md Agent guidance
│   ├── workflows/
│   │   ├── release.yml         Signed binary release
├── CHANGELOG.md                Activation + routing changes
├── RELEASING.md                Release procedures
└── TROUBLESHOOTING.md          Diagnostic playbook
```

---

## Configuration

Launcher frontend configuration is environment-based. Backend services are
discovered via environment variables:

```bash
# Backend URLs (required; defaults shown)
VITE_BATCH_FNR_URL=http://127.0.0.1:8000
VITE_DRAWING_LIST_MANAGER_URL=http://127.0.0.1:8002
VITE_TRANSMITTAL_BUILDER_URL=http://127.0.0.1:8001

# Activation enforcement (optional; defaults to permissive)
LAUNCHER_ENFORCE_PIN=1  # Fail startup if no activation token
```

- `VITE_BATCH_FNR_URL` — URL for Batch Find & Replace backend service
- `VITE_DRAWING_LIST_MANAGER_URL` — URL for Drawing List Manager backend service
- `VITE_TRANSMITTAL_BUILDER_URL` — URL for Transmittal Builder backend service
- `LAUNCHER_ENFORCE_PIN=1` enables startup fail-fast when no activation token exists
- Additional backend URLs can be added by updating environment config and
  `frontend/src/App.jsx` `AVAILABLE_APPS` table

When a user activates:

1. Launcher collects hardware (hostname + Windows SID + MAC → SHA256 hash)
2. Calls `desktop-toolkit` activation API: `/api/enrollment/request-pin` (office IP check)
3. User enters PIN
4. Launcher calls `/api/enrollment/activate` → receives signed token
5. Token stored in browser localStorage
6. Launcher routes to registered backend app on success

---

## Activation & Security

Activation is **centralized in `desktop-toolkit`**; launcher is just the client:

- **Office IP gating** — PIN requests only from configured IP ranges
- **Hardware binding** — Token tied to machine (hostname + SID + MAC)
- **Token signing** — HMAC-SHA256 prevents forgery
- **Single-use PINs** — Burned after activation
- **14-day expiry** — Tokens eventually expire; offline grace window
- **Admin revocation** — Can revoke machines server-side

Launcher request behavior for backend APIs:

- Backend calls are wrapped with `withActivationHeaders()` and send
  `Authorization: Bearer <activation_token>` when a token is present.
- In activation-enforced builds (`LAUNCHER_ENFORCE_PIN=1`), launcher startup
  fails fast if no activation token exists.
- A backend `401` response is treated as an auth revocation/expiry signal:
  launcher clears local activation state and returns the user to activation.

See [`desktop-toolkit` activation docs](https://github.com/chamber-19/desktop-toolkit) for API details.

---

## Setup

`@chamber-19/desktop-toolkit` is published to GitHub Packages, which requires
authentication even for public packages.

1. Create a GitHub classic PAT at <https://github.com/settings/tokens/new>
  with **only** the `read:packages` scope.

1. Export it before running `npm install` inside `frontend/`.
  **macOS / Linux:**

  ```bash
  export NODE_AUTH_TOKEN=<YOUR_GITHUB_PACKAGES_TOKEN>
  cd frontend && npm install
  ```

  **Windows PowerShell:**

  ```powershell
  $env:NODE_AUTH_TOKEN = "<YOUR_GITHUB_PACKAGES_TOKEN>"
  cd frontend; npm install
  ```

1. In CI, `GITHUB_TOKEN` is used automatically; no extra secret is required.

---

## Develop

```bash
cd frontend
npm install
npm run desktop      # = tauri dev
```

Tauri dev server watches for changes and hot-reloads the frontend. Rust changes
require a restart.

---

## Build

```bash
cd frontend
npm run desktop:build   # = tauri build
```

The NSIS installer is placed in `frontend/src-tauri/target/release/bundle/nsis/`.

Binaries are signed as part of the release workflow.

---

## Reference

| Document | Purpose |
|----------|---------|
| [RELEASING.md](./RELEASING.md) | How to cut a release; signing, updater config |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local dev workflow and branching |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Diagnostic playbook |
| [CHANGELOG.md](./CHANGELOG.md) | Activation, routing, updater changes |
| [docs/AUTO_UPDATER.md](./docs/AUTO_UPDATER.md) | Auto-updater contract |

---

© 2026 Chamber 19
