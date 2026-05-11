# Chamber19 Launcher — Troubleshooting

This document covers common issues encountered when installing, running,
updating, or building Chamber19 Launcher.

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

## 2. Update check fails or loops

**Symptom:** The splash screen appears and the app is stuck on "Checking for
updates…" or the update prompt appears every launch despite installing.

**Fix:**

1. Check internet connectivity — the update check calls the GitHub Releases API.
2. Verify the GitHub Release for the latest tag has an NSIS installer asset
   (name ending `_x64-setup.exe`). If the asset is missing, the check returns
   no update and the app opens normally.
3. If the installer fails to launch, check `%TEMP%\chamber19-launcher-update.exe`
   exists and is not corrupted (zero bytes). Delete it and relaunch to retry.

**Dev/testing:** To skip the update check during development, the update gate in
`App.jsx` fails open — if `check_launcher_update` returns an error the app opens
normally.

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

## 5. Update prompt not appearing despite new GitHub Release

**Symptom:** App opens normally even though a newer version tag exists on GitHub.

**Fix:**

1. Confirm the GitHub Release has an NSIS installer asset. The update check
   looks for an asset named `*_x64-setup.exe` or `*-setup.exe`. If the release
   was created without the asset (e.g. the CI build failed), no update is offered.
2. Confirm the release tag is not a pre-release. The Releases API `/latest`
   endpoint returns the most recent non-pre-release, non-draft release.
3. Check that the tag's version string is newer than the running app version
   (strip the `v` prefix: `v0.2.0` → `0.2.0`, compared by semver).

---

## 6. Dependabot RUSTSEC alerts on `glib 0.18` / `rand 0.7`

**Symptom:** The repository **Security → Dependabot** tab shows open alerts
against transitive crates pulled in by Tauri.

**Cause:** Both crates come in via `gtk-rs 0.18 → tao → tauri-runtime-wry`,
and only compile when targeting **Linux/GTK**. Chamber19 Launcher ships a Windows-only
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
> cautionary reference for future Chamber19 Launcher releases — not because the same code
> exists in Chamber19 Launcher.

In transmittal-builder v6.2.2, `release.yml` used `Select-Object -First 1` to
locate the installer EXE. When a cached older installer appeared first in the
file listing, the wrong version was uploaded to the GitHub Release. The fix was
to use `Select-Object -Last 1` (sorted by name, which is filename-order and
therefore version-order for Tauri's `ProductName_Version_arch-setup.exe` naming
convention). Be aware of this failure mode if you ever modify the
installer-selection logic in `release.yml`.
