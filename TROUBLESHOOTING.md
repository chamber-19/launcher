# Shopvac — Troubleshooting

This document covers common issues encountered when installing, running, or
building Shopvac.

---

## 1. Windows SmartScreen "Unknown publisher" warning

**Symptom:** After double-clicking the installer, Windows displays:

> Windows protected your PC
> Microsoft Defender SmartScreen prevented an unrecognized app from starting.

**Cause:** The NSIS installer is unsigned. This is expected for internal
distribution without a code-signing certificate.

**Fix (users):**

1. Click **"More info"** (the small link under the warning).
2. Click **"Run anyway"**.
3. The installer proceeds normally.

**Fix (future — ops/dev):** Obtain an Authenticode code-signing certificate
and add it to CI. The workflow already has a placeholder comment showing
exactly where `signtool` slots in. See `RELEASING.md §1 — Code signing`.

---

## 2. "Cannot reach shared drive" on launch

**Symptom:** The splash screen appears, then the app shows an error dialog and
exits without opening the main window.

**Fix:**

1. Ensure **Google Drive for Desktop** is running and signed in.
2. Verify the shared drive is mounted at `G:` in File Explorer.
3. If the drive letter changed, edit
   `%APPDATA%\Shopvac\update-source.json` to point at the new path.
4. If you are on VPN, ensure the VPN tunnel is connected before launching.

**Dev/testing override:**

```powershell
$env:SHOPVAC_UPDATE_PATH = "C:\tmp\fake-drive"
```

---

## 3. "Cargo.toml version does not match tauri.conf.json"

**Symptom:** `tauri build` fails with a version mismatch warning/error.

**Fix:** All three files must have the same version string:

- `frontend/src-tauri/tauri.conf.json` → `"version"`
- `frontend/src-tauri/Cargo.toml` → `version`
- `frontend/package.json` → `"version"`

Run `node scripts/bump-version.mjs <version>` to update all three atomically.

---

## 4. `npm install` fails with 401 Unauthorized

**Symptom:**

```text
npm error code E401
npm error 401 Unauthorized - GET https://npm.pkg.github.com/...
```

**Cause:** `@chamber-19/desktop-toolkit` is hosted on GitHub Packages, which
requires authentication even for public packages.

**Fix:**

1. Create a GitHub classic PAT at <https://github.com/settings/tokens/new>
   with **only** the `read:packages` scope.
2. Export before running `npm install`:

   ```bash
   export NODE_AUTH_TOKEN=ghp_yourTokenHere
   cd frontend && npm install
   ```

---

## 5. latest.json parse error / update not triggering

**Symptom:** App opens normally even though a newer version exists on the
shared drive, OR the app update dialog shows garbled version text.

**Fix:**

1. Validate the file manually:

   ```powershell
   Get-Content "G:\Shared drives\R3P RESOURCES\APPS\Shopvac\latest.json" | ConvertFrom-Json
   ```

2. Ensure `version` is a bare semver string, e.g. `"0.2.0"` (no `v` prefix).
3. If the file is missing, re-run:

   ```powershell
   .\scripts\publish-to-drive.ps1 -Tag v0.2.0
   ```

---

## 6. Dependabot RUSTSEC alerts on `glib 0.18` / `rand 0.7`

**Symptom:** The repository **Security → Dependabot** tab shows open alerts
against transitive crates pulled in by Tauri.

**Cause:** Both crates come in via `gtk-rs 0.18 → tao → tauri-runtime-wry`,
and only compile when targeting **Linux/GTK**. Shopvac ships a Windows-only
NSIS installer, so the vulnerable code is never built into the binary we
distribute.

**Fix:**

1. Future Dependabot PRs/alerts for these two packages are suppressed by
   `.github/dependabot.yml`. No action required for new alerts.
2. **Existing** open alerts require a one-time manual dismissal via the
   GitHub UI (Security → Dependabot → alert #N → Dismiss → Tolerable risk).
   Reason text: _"Transitive Linux-only dependency via gtk-rs; we only ship
   Windows NSIS bundles. Will be removed when Tauri upgrades past
   gtk-rs 0.18."_

---

## 7. Lessons learned from a sibling repository (historical)

> **Historical archive:** the following is a summary of a production incident
> in `chamber-19/transmittal-builder` v6.2.2. It is included here as a
> cautionary reference for future Shopvac releases — not because the same code
> exists in Shopvac.

In transmittal-builder v6.2.2, `release.yml` and `publish-to-drive.ps1` both
used `Select-Object -First 1` to locate the installer EXE. When a cached older
installer appeared first in the file listing, the wrong version was uploaded to
the GitHub Release. The fix was to use `Select-Object -Last 1` (sorted by
name, which is filename-order and therefore version-order for Tauri's
`ProductName_Version_arch-setup.exe` naming convention), and to validate the
uploaded filename in `generate-latest-json.mjs`.

Shopvac's `publish-to-drive.ps1` already incorporates this fix. If you ever
need to modify the installer-selection logic, be aware of this failure mode.
