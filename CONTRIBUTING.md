# Contributing to Shopvac

Thank you for contributing to **Chamber-19 Shopvac** — the desktop tool shell
for Chamber 19.

This document covers the repository architecture, branching model, versioning
rules, and the release workflow. For the step-by-step mechanics of cutting a
release, see [RELEASING.md](./RELEASING.md).

---

## 1. Introduction

`shopvac` contains the Tauri desktop shell:

- **`frontend/`** — the Tauri/Vite/React desktop shell, consuming
  [`@chamber-19/desktop-toolkit`](https://github.com/chamber-19/desktop-toolkit)
  from GitHub Packages.

AutoCAD-side workflows are handled by Autodesk's first-party Assistant in
AutoCAD 2027+; Shopvac no longer ships a managed plugin.

---

## 2. Repository map

| Path | Role | Consumes |
|------|------|----------|
| `frontend/` | Tauri desktop shell | `@chamber-19/desktop-toolkit` (npm), `desktop-toolkit` crate (git tag) |
| `scripts/` | Release automation | Node.js + PowerShell |
| `docs/` | Reference documentation | — |

---

## 3. Branching model

| Branch | Purpose |
|--------|---------|
| `main` | Always releasable. Protected — no direct pushes. |
| `feat/<short-name>` | New features |
| `fix/<short-name>` | Bug fixes |
| `refactor/<short-name>` | Refactors (no behaviour change) |
| `docs/<short-name>` | Documentation-only changes |

**All changes go through pull requests to `main`.** No direct pushes to `main`.

---

## 4. Versioning & dependency pinning

This repo follows **[SemVer](https://semver.org/)** (`MAJOR.MINOR.PATCH`).

A release tag `vX.Y.Z` on `main` refers to the desktop app version.

### Pinning desktop-toolkit

`frontend/package.json` uses a caret range (`^2.2.4`) — the lockfile
(`package-lock.json`) is the actual binding pin. `frontend/src-tauri/Cargo.toml`
pins the matching git tag exactly (`tag = "v2.2.4"`). Both must be bumped
together in the same PR.

---

## 5. Release workflow

> High-level summary. See [RELEASING.md](./RELEASING.md) for full step-by-step
> mechanics, rollback instructions, and troubleshooting.

### Desktop app release

1. Open a PR → CI green → merge to `main`.
2. Bump the version in all three files (see `RELEASING.md §2`).
3. Tag `vX.Y.Z` and push the tag:

   ```powershell
   git tag vX.Y.Z
   git push && git push --tags
   ```

4. CI builds the Vite frontend and the Tauri installer; a GitHub Release is
   created with the installer attached.
5. Smoke-test the built installer locally before running
   `scripts/publish-to-drive.ps1`.

---

## 6. Local development — desktop app

### Prerequisites

1. [Node.js](https://nodejs.org/) ≥ 20 and npm
2. [Rust](https://www.rust-lang.org/tools/install) — `rustup` installs the
   toolchain
3. A GitHub classic PAT with `read:packages` scope (for `npm install`)

### Additional prerequisites (Linux)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  patchelf libssl-dev libayatana-appindicator3-dev
```

### Run the desktop app

```bash
export NODE_AUTH_TOKEN=ghp_yourTokenHere   # PAT with read:packages
cd frontend
npm install
npm run desktop      # = tauri dev
```

### Build a distributable installer

```bash
cd frontend
npm run desktop:build   # = tauri build
```

The installer is placed in `frontend/src-tauri/target/release/bundle/nsis/`.

---

## 7. Commit & PR conventions

This project uses **[Conventional Commits](https://www.conventionalcommits.org/)**:

| Prefix | Use for |
|--------|---------|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change with no behaviour change |
| `chore:` | Build, tooling, dependency updates |

---

## 8. Documentation policy

This repo enforces a "no stale docs" rule. See
[`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for
the full mapping of code-paths-to-docs that must be kept in sync. Human
contributors are bound by the same rule as the coding agent — if your PR
changes code that has documented behaviour, the docs change in the same PR.

---

## 9. Code of conduct & contact

Be respectful and constructive in all interactions.

For questions, bug reports, or feature requests, open an
[issue on GitHub](https://github.com/chamber-19/shopvac/issues).
