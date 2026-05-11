# Auto-Updater

The launcher checks GitHub Releases for a newer version on every startup. If one
is found the user is prompted to install it — no dismiss option. The main app
does not open until the launcher is up to date.

There is no shared drive, no `latest.json` manifest, and no network share required.
Distribution is entirely through GitHub Releases.

---

## How It Works

1. On app mount React calls `invoke('check_launcher_update')`.
2. Rust calls the GitHub Releases API for `chamber-19/launcher` and compares the
   latest tag against the running version using semver.
3. If the running version is current, the main app loads immediately.
4. If a newer version exists and its NSIS installer asset is present, Rust returns
   `{ update_available: true, version, download_url, notes }`.
5. React renders the **Update Available** screen, which blocks the main UI.
6. The user clicks **Install and restart**:
   - Rust downloads the NSIS installer from the GitHub Release asset URL into a
     temp directory.
   - The installer is spawned detached with the `/S` (silent) NSIS flag.
   - The launcher exits. NSIS installs the new version and relaunches the app.
7. If the GitHub API is unreachable (offline, rate-limited), the check fails
   silently and the app opens normally — the update prompt appears on the next
   successful check.

---

## Mandatory vs. Optional Updates

Updates are mandatory: the app will not open until the user installs. This keeps
all users on the current version at all times.

---

## Release Asset Naming

The update check locates the first asset whose name ends with `_x64-setup.exe`
or `-setup.exe`. `tauri build` + NSIS produces
`Chamber19.Launcher_<version>_x64-setup.exe` which matches this pattern.

---

## Error Handling

| Condition | Behaviour |
|---|---|
| GitHub API unreachable | Silent fail, app opens normally |
| No NSIS asset in latest release | `update_available: false`, app opens normally |
| Download fails | Error screen shown; close and reopen to retry |
| Installer exits non-zero | Installer owns its own error UI; launcher already exited |

---

## Backend Updates

Backend sidecar exes (`transmittal-backend.exe` etc.) are managed separately by
`backend_manager.rs`. Each backend is pinned to a version in `backends.json`
baked into the launcher binary. When a backend repo publishes a new release, a
`repository_dispatch` event triggers `backend-released.yml` in this repo, which
opens a PR bumping the pinned version. Merging that PR and cutting a new launcher
tag distributes the updated backend to users via the same force-update mechanism.

See `frontend/src-tauri/backends.json` and `backend_manager.rs` for the
backend download and cache logic.
