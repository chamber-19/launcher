# Releasing Shopvac

This document covers the full release lifecycle: one-time setup, cutting a
release, rolling back, and troubleshooting.

---

## 1. One-time setup

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS | `node --version` |
| Rust | stable | `rustup update stable` |
| GitHub CLI | latest | `gh auth login` |
| Google Drive for Desktop | latest | R3P shared drive must be mounted as `G:` |

### Shared drive path

The app defaults to reading updates from:

```text
G:\Shared drives\R3P RESOURCES\APPS\Shopvac\
```

Override for dev/testing by setting the environment variable:

```powershell
$env:SHOPVAC_UPDATE_PATH = "C:\path\to\local\test\folder"
```

The folder must contain `latest.json` and the installer `.exe`.

### Code signing (future improvement)

Code signing with an Authenticode certificate is **not required** for initial
internal distribution. Windows SmartScreen will warn on first run but users
can click "More info → Run anyway." To add signing later:

1. Obtain a code-signing certificate.
2. Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as
   GitHub repository secrets.
3. Update the CI workflow to pass these to `tauri build`.

---

## 2. Cutting a desktop app release

### Step 1 — Bump the version

Edit **all three** files:

| File | Key |
|------|-----|
| `frontend/src-tauri/tauri.conf.json` | `"version"` |
| `frontend/package.json` | `"version"` |
| `frontend/src-tauri/Cargo.toml` | `version` |

All three must match, e.g. `0.1.0`. Use the helper script:

```bash
node scripts/bump-version.mjs 0.2.0
```

### Step 2 — (Optional) Add release notes

Create `RELEASE_NOTES.md` at the repository root. This content ends up in the
GitHub Release body and in `latest.json` > `notes`.

```markdown
## What's new in v0.2.0
- Summary of changes
```

### Step 3 — Tag and push

```powershell
git add .
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push && git push --tags
```

### Step 4 — Wait for CI

The `.github/workflows/release.yml` workflow triggers on the tag push.
Monitor it at `https://github.com/chamber-19/shopvac/actions`.

It will:

1. Build the Vite frontend.
2. Run `tauri build` → produces `Shopvac_0.2.0_x64-setup.exe`.
3. Generate `latest.json`.
4. Create a GitHub Release and upload both files.

> **Filename note:** `softprops/action-gh-release` sanitises spaces to dots on
> upload, so the GitHub Release asset is named `Shopvac_<version>_x64-setup.exe`.
> `publish-to-drive.ps1` uses a glob pattern to locate the installer, so it is
> filename-agnostic and unaffected by this sanitisation.

### Step 5 — Publish to shared drive

After CI completes and the GitHub Release is created:

1. Run the publish script:

   ```powershell
   .\scripts\publish-to-drive.ps1 -Tag v0.2.0
   ```

   This downloads the release assets from GitHub, archives the previous
   installer on the shared drive, and copies the new installer + `latest.json`
   into place.

Within ~24 hours every user who launches the app will see the
**Update Available** prompt.

---

## 3. AutoCAD plugin release (independent cadence)

> **Important:** The AutoCAD plugin (`tools/ch19-line-totaler/`) versions
> **independently** from the desktop app. Do not tie its version to the desktop
> app tag. Use `acad-vX.Y.Z` tags for plugin releases.

1. Bump `AssemblyInfo.cs` (`[assembly: AssemblyVersion("X.Y.Z")]`) and
   `Ch19LineTotaler.csproj` (`<Version>X.Y.Z</Version>`).
2. Commit and tag:

   ```powershell
   git commit -m "chore: bump ch19-line-totaler to X.Y.Z"
   git tag acad-vX.Y.Z
   git push && git push --tags
   ```

3. Build on a Windows machine with AutoCAD installed:

   ```powershell
   cd tools/ch19-line-totaler
   dotnet build -c Release
   ```

4. Distribute the resulting `Ch19LineTotaler.dll` via your internal channel.

---

## 4. Rollback

If a release has a critical bug:

1. In the shared drive, move the bad installer back to `archive\` and restore
   the previous installer from `archive\`:

   ```powershell
   $drive = "G:\Shared drives\R3P RESOURCES\APPS\Shopvac"
   Move-Item "$drive\Shopvac_0.2.0_x64-setup.exe" "$drive\archive\"
   Copy-Item "$drive\archive\Shopvac_0.1.0_x64-setup.exe" "$drive\"
   ```

2. Edit `latest.json` on the shared drive and set `"version"` back to the
   previous good version (e.g. `"0.1.0"`).

3. Users with the bad version will see the "older" manifest and the updater
   will not trigger. They will need to manually run the old installer from
   the shared drive.

---

## 5. Troubleshooting

### Windows SmartScreen warning

**Symptom:** First-run users see "Windows protected your PC" dialog.

**Cause:** The installer is not code-signed (acceptable for internal use).

**Fix:** Users click "More info" → "Run anyway". For a production release,
add Authenticode signing (see §1).

### Cargo.toml version does not match tauri.conf.json

**Symptom:** `tauri build` fails with a version mismatch warning/error.

**Fix:** All three files must have the same version string:

- `frontend/src-tauri/tauri.conf.json` → `"version"`
- `frontend/src-tauri/Cargo.toml` → `version`
- `frontend/package.json` → `"version"`

Update all three before tagging a release. Use `scripts/bump-version.mjs`.

### Local smoke-test before tagging

> **Always** run a full local Tauri build after any `@chamber-19/desktop-toolkit`
> version bump (or other changes to `tauri.conf.json`) before pushing a release
> tag.

```powershell
cd frontend
npm run desktop:build
```

A successful build means the NSIS script compiled cleanly and the `.exe`
installer was produced.
