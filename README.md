# shopvac

Chamber-19 desktop tool shell built on [`@chamber-19/desktop-toolkit`](https://github.com/chamber-19/desktop-toolkit). Provides a Tauri v2 + React/Vite frontend with splash, updater, and main windows pre-wired. Includes a self-contained AutoCAD plugin under `tools/ch19-line-totaler/`.

## Repository layout

```
shopvac/
├── .gitignore
├── .npmrc
├── LICENSE
├── README.md
├── package.json
├── Cargo.toml                    workspace: src-tauri only
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   └── App.jsx
├── splash.html
├── splash.jsx
├── updater.html
├── updater.jsx
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       └── lib.rs
└── tools/
    └── ch19-line-totaler/        self-contained AutoCAD DLL
```

## Consuming desktop-toolkit

Both the npm package and the Rust crate are pinned to **v2.2.4**:

- **npm:** `"@chamber-19/desktop-toolkit": "2.2.4"` in `package.json`
- **Rust:** `desktop-toolkit = { git = "https://github.com/chamber-19/desktop-toolkit", tag = "v2.2.4" }` in `src-tauri/Cargo.toml`

No desktop-toolkit source is vendored here. See the [desktop-toolkit README](https://github.com/chamber-19/desktop-toolkit#readme) for the full API story.

## Setup

`@chamber-19/desktop-toolkit` is published to GitHub Packages, which requires authentication even for public packages.

1. Create a GitHub classic PAT at <https://github.com/settings/tokens/new> with the **`read:packages`** scope.

2. Export it before running `npm install`:

   **macOS / Linux**
   ```bash
   export NODE_AUTH_TOKEN=ghp_yourTokenHere
   npm install
   ```

   **Windows PowerShell**
   ```powershell
   $env:NODE_AUTH_TOKEN = "ghp_yourTokenHere"
   npm install
   ```

3. In CI, add `NODE_AUTH_TOKEN` as a repository secret and pass it to the npm install step.

## Develop

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

The installer is placed in `src-tauri/target/release/bundle/`.

## AutoCAD plugin

See [`tools/ch19-line-totaler/README.md`](tools/ch19-line-totaler/README.md).

## Versioning

All `@chamber-19/*` dependencies are pinned to exact versions (no `^` or `~` ranges). When upgrading desktop-toolkit, update both the npm version in `package.json` and the git tag in `src-tauri/Cargo.toml` together.
