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
   ┌────▼───┐  ┌─────▼──────────┐
   │desktop-│  │[Backend App]   │
   │toolkit │  │(HTTP service)  │
   │(auth)  │  │e.g. transmittal│
   └────────┘  └────────────────┘
```

Each backend app registers an HTTP endpoint; launcher routes users to it after
activation succeeds.

---

## Repository layout

```text
launcher/
├── frontend/                   Tauri + React desktop app
│   ├── src/                    React components (ActivationGate, App, etc.)
│   ├── src-tauri/              Rust + Tauri config
│   │   └── src/
│   │       ├── main.rs         App init, sidecar launch
│   │       ├── lib.rs          Tauri setup
│   │       ├── sidecar.rs      Sidecar lifecycle
│   │       └── activation.rs   Activation commands (hardware, PIN, token)
│   ├── package.json
│   └── vite.config.js
├── scripts/                    Release automation, version bumps
├── docs/                       Reference documentation
├── .github/
│   ├── copilot-instructions.md Agent guidance
│   ├── workflows/
│   │   ├── release.yml         Signed binary release
│   │   └── toolkit-pin-check.yml Dependency validation
├── CHANGELOG.md                Activation + routing changes
├── RELEASING.md                Release procedures
└── TROUBLESHOOTING.md          Diagnostic playbook
```

---

## Configuration

Launcher discovers and routes to backend apps via configuration. Each tool
registers as an HTTP endpoint:

```json
{
  "apps": [
    {
      "id": "transmittal-builder",
      "name": "Transmittal Builder",
      "sidecar": "transmittal-backend",
      "port": 8001
    }
  ],
  "activation": {
    "office_ip_ranges": "203.0.113.0/24,198.51.100.0/24",
    "token_expiry_days": 14
  }
}
```

When a user activates:

1. Launcher collects hardware (hostname + Windows SID + MAC → SHA256 hash)
2. Calls `desktop-toolkit` activation API: `/enrollment/request-pin` (office IP check)
3. User enters PIN
4. Launcher calls `/enrollment/activate` → receives signed token
5. Token stored in browser localStorage (encrypted by OS DPAPI on Windows)
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

See [`desktop-toolkit` activation docs](https://github.com/chamber-19/desktop-toolkit) for API details.

---

## Setup

`@chamber-19/desktop-toolkit` is published to GitHub Packages, which requires
authentication even for public packages.

1. Create a GitHub classic PAT at <https://github.com/settings/tokens/new>
   with **only** the `read:packages` scope.

2. Export it before running `npm install` inside `frontend/`:

   **macOS / Linux:**

   ```bash
   export NODE_AUTH_TOKEN=ghp_yourTokenHere
   cd frontend && npm install
   ```

   **Windows PowerShell:**

   ```powershell
   $env:NODE_AUTH_TOKEN = "ghp_yourTokenHere"
   cd frontend; npm install
   ```

3. In CI, `GITHUB_TOKEN` is used automatically — no extra secret required.

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
