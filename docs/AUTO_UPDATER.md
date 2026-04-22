# Auto-Updater

Shopvac ships a lightweight, G:\-based auto-updater that reads a manifest from
the shared drive on every launch and prompts the user to install a newer version
when one is available.

There is no public hosting, no Tauri updater plugin, and no signing requirement.
Distribution is internal-only over Google Drive.

Shopvac uses the desktop-toolkit updater shim unmodified — the shim binary
(`desktop-toolkit-updater.exe`) is built from
[`chamber-19/desktop-toolkit`](https://github.com/chamber-19/desktop-toolkit)
at tag `v2.2.4` by CI and bundled into the NSIS installer.

---

## How It Works

1. On app mount the React frontend calls `invoke('check_for_update')`.
2. Rust reads `update-source.json` from the user's app config directory
   (`%APPDATA%\Shopvac\update-source.json`) to determine whether the check
   is enabled and where to find the manifest.
3. If the check is enabled, Rust reads `latest.json` from the configured path.
   If the drive is unreachable or the file is missing, the check fails
   **silently** (console log only — no error popup).
4. The manifest version is compared to the running version using the `semver`
   crate, so `0.1.10 > 0.1.9` is handled correctly.
5. If a newer version is found and its installer exists on the shared drive,
   Rust returns `{ updateAvailable: true, version, installerPath, notes }` to
   the React caller.
6. The **Update Available** modal appears, blocking the main UI:
   - **Install Now** — invokes `apply_update`, which spawns the installer with
     `/S` (silent NSIS flag) and calls `app.exit(0)`. All file locks are
     released before the installer overwrites them.
   - **Remind Me Later** — session-only dismiss. The modal reappears on next
     launch.

---

## Manifest Location

Default path (baked in at build time, overridable per machine):

```text
G:\Shared drives\R3P RESOURCES\APPS\Shopvac\latest.json
```

The installer must live in the **same folder** as `latest.json`:

```text
G:\Shared drives\R3P RESOURCES\APPS\Shopvac\
  ├── latest.json
  └── Shopvac_<version>_x64-setup.exe
```

### `latest.json` format

`scripts/generate-latest-json.mjs` (run by CI) produces:

```json
{
  "version": "0.1.0",
  "pub_date": "2026-04-22T00:00:00Z",
  "installer": "Shopvac_0.1.0_x64-setup.exe",
  "notes": "What's new in v0.1.0",
  "mandatory": true
}
```

---

## Per-Machine Override (`update-source.json`)

On first launch the app writes:

```json
{
  "manifestPath": "G:\\Shared drives\\R3P RESOURCES\\APPS\\Shopvac\\latest.json",
  "enabled": true
}
```

to `%APPDATA%\Shopvac\update-source.json`. Edit this file to redirect or
disable the update check without rebuilding the app.

---

## Error Handling

All errors during the update check degrade silently:

| Condition | Behaviour |
|---|---|
| G:\ drive not mounted | Console log only, app opens normally |
| `latest.json` missing or unreadable | Console log only, app opens normally |
| Malformed JSON | Console log only, app opens normally |
| Installer `.exe` not found on drive | Console log only, no modal shown |
| Version string not valid semver | Console log only, treated as up-to-date |

---

## Release Flow

After the GitHub Actions release workflow completes (triggered by a `v*` tag):

1. Go to the GitHub Release page for the new tag.
2. Download both assets: `Shopvac_<version>_x64-setup.exe` and `latest.json`.
3. Open `G:\Shared drives\R3P RESOURCES\APPS\Shopvac\` in File Explorer.
4. Move the **old** installer to an `archive\` sub-folder (safety net).
5. Copy the **new** installer and `latest.json` into the folder.

See [RELEASING.md](../RELEASING.md) for the full release procedure.
