# DevNotes Desktop — Windows Installer & Auto-Updater

## Building the NSIS Installer

### Prerequisites
- Rust + MSVC toolchain
- Node.js 18+
- [NSIS](https://nsis.sourceforge.io/Download) installed on PATH (Windows only)

### Build
```bash
cd devnotes-desktop
npm install
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/nsis/DevNotes_1.0.0_x64-setup.exe`

The NSIS installer:
- Single-file `.exe` with LZMA compression
- Installs to `Program Files\DevNotes` (per-machine) or `AppData\Local\DevNotes` (per-user)
- Creates a Start Menu shortcut and optional desktop shortcut
- Adds to Windows Apps & Features for clean uninstall
- Registers the app for Windows auto-start (via `tauri-plugin-autostart`)

---

## Auto-Updater Setup

DevNotes uses **Tauri's built-in updater** (GitHub Releases or custom server).

### Step 1 — Generate a signing key pair
```bash
npm run tauri signer generate -- -w ~/.tauri/devnotes.key
```
This outputs:
- `~/.tauri/devnotes.key` — private key (keep secret, used in CI)
- Public key — paste into `tauri.conf.json` → `plugins.updater.pubkey`

### Step 2 — Set up a release endpoint

#### Option A: GitHub Releases (easiest)

Use the [tauri-action](https://github.com/tauri-apps/tauri-action) GitHub Action:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
```

The action builds the installer, signs it, and creates a GitHub Release with
a `latest.json` update manifest automatically.

Update endpoint in `tauri.conf.json`:
```json
"endpoints": [
  "https://github.com/YOUR_ORG/devnotes-desktop/releases/latest/download/latest.json"
]
```

#### Option B: Custom server

Host a `latest.json` at a static URL with this structure:
```json
{
  "version": "1.1.0",
  "notes":   "Bug fixes and performance improvements",
  "pub_date": "2026-03-07T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "BASE64_SIGNATURE_HERE",
      "url": "https://releases.yourapp.com/DevNotes_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

### Step 3 — Check for updates in-app

DevNotes calls the updater on startup via Settings → About → "Check for Updates".

The Tauri updater dialog will appear automatically if a new version is found.

---

## Update Flow (user experience)

1. App starts → silently checks endpoint in background
2. If update available → toast notification: "DevNotes 1.1.0 is available"
3. User clicks → modal shows release notes
4. User clicks Install → downloads, verifies signature, installs, relaunches

---

## Signing & Security

All releases are signed with Ed25519. The public key is embedded in the app binary.
An update with an invalid or missing signature is **rejected automatically**.
Never ship a `tauri.conf.json` with `"dangerousInsecureTransportProtocol": true`.

---

## Version bumping

```bash
# bump version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml
npm run tauri:build
git tag v1.1.0
git push --tags
```
