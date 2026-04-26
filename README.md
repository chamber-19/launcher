# Shopvac

A Chamber 19 desktop tool shell, built on
[`@chamber-19/desktop-toolkit`](https://github.com/chamber-19/desktop-toolkit).

**Components:**

- **`frontend/`** — Tauri v2 / React / Vite desktop app with splash, updater,
  and main window pre-wired via `desktop-toolkit`.

Currently a tool shell only — AutoCAD-side workflows handled by Autodesk's
first-party Assistant in AutoCAD 2027+.

---

## Repository layout

```text
shopvac/
├── frontend/                   Tauri desktop app
│   ├── src/                    React source
│   ├── src-tauri/              Rust + Tauri config
│   ├── package.json
│   └── vite.config.js
├── scripts/                    Release automation
├── docs/                       Reference documentation
├── .github/
│   ├── copilot-instructions.md
│   ├── copilot/mcp-config.json
│   ├── dependabot.yml
│   └── workflows/
│       ├── copilot-setup-steps.yml
│       └── release.yml
└── .vscode/
    ├── mcp.json
    └── settings.json
```

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

---

## Build

```bash
cd frontend
npm run desktop:build   # = tauri build
```

The NSIS installer is placed in `frontend/src-tauri/target/release/bundle/nsis/`.

---

## Reference

| Document | Purpose |
|----------|---------|
| [RELEASING.md](./RELEASING.md) | How to cut a release |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local dev workflow and branching model |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Diagnostic playbook |
| [MIGRATION.md](./MIGRATION.md) | Version upgrade notes |
| [docs/mcp.md](./docs/mcp.md) | MCP server catalogue |
| [docs/AUTO_UPDATER.md](./docs/AUTO_UPDATER.md) | Auto-updater contract |

---

© 2026 Chamber 19
