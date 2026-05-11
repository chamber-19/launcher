# Releasing Chamber19 Launcher

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

No shared drive access is required. Distribution is through GitHub Releases only.

### Code signing (future improvement)

Code signing with an Authenticode certificate is **not required** for initial
internal distribution. Windows SmartScreen will warn on first run but users
can click "More info → Run anyway." To add signing later:

1. Obtain a code-signing certificate.
2. Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as
   GitHub repository secrets.
3. Update the CI workflow to pass these to `tauri build`.

---

## 2. Cutting a release

### Step 1 — Bump the version

Edit **all three** files:

| File | Key |
|------|-----|
| `frontend/src-tauri/tauri.conf.json` | `"version"` |
| `frontend/package.json` | `"version"` |
| `frontend/src-tauri/Cargo.toml` | `version` |

All three must match, e.g. `0.2.0`. Use the helper script:

```bash
node scripts/bump-version.mjs 0.2.0
```

### Step 2 — (Optional) Add release notes

Create `RELEASE_NOTES.md` at the repository root. This content appears in the
GitHub Release body and is displayed to users in the update prompt.

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
Monitor it at `https://github.com/chamber-19/launcher/actions`.

It will:

1. Build the Vite frontend.
2. Run `tauri build` → produces `Chamber19.Launcher_0.2.0_x64-setup.exe`.
3. Create a GitHub Release and upload the installer.

That's it. Users who open the launcher will see the **Update Available** prompt
on their next launch and be forced to update before the app opens.

---

## 3. Rollback

If a release has a critical bug, publish a new patch release with the fix. Users
will be force-updated to the patch on their next launch.

If you need to prevent further installs of a bad version before the fix is ready:
edit the GitHub Release and delete the NSIS installer asset. The update check will
then return `update_available: false` (no matching asset found) and users will
continue running their current version.

---

## 4. Troubleshooting

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
