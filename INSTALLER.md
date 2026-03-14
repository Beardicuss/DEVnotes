# DevNotes Desktop — Windows Setup & Publishing

DevNotes Desktop is distributed using a custom standalone **Inno Setup** installer script, which guarantees that all required desktop shortcut icons accurately scale across Windows contexts (Taskbar, Start Menu, Desktop, and File Explorer) without blurriness.

## The Publishing Architecture

Instead of directly distributing the bundled output from Tauri, we use a two-step process:

1. **Build the Release Binary**: We use `cargo tauri build` to compile the standard optimized executable, which also internally embeds the `dev.ico` file.
2. **The `publish` Directory**: The resulting `.exe` and the raw `dev.ico` file are copied into a standalone `publish` folder at the root of the project.
3. **Inno Setup Compilation**: The `dev.iss` script is then used to compile the final `.exe` installer.

### Why This Custom Approach?
Windows uses a very specific icon resolution system. It expects an `.ico` file to literally contain multiple embedded image sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256). If an installer or shortcut merely references a single-sized icon or relies on the executable's primary resource, Windows will stretch it or shrink it, resulting in terrible scaling and blurriness.
Our `dev.iss` strictly points shortcuts directly to the embedded raw `dev.ico` which we generated using Tauri's CLI image processor to guarantee all 6 resolutions are present.

---

## Step-by-Step Build Instructions

### Prerequisites
Make sure your environment meets the criteria in `requirements.txt`:
* Node.js (v18+)
* Rust (`rustup` component) + Cargo
* Tauri CLI (`npm install -g @tauri-apps/cli`)
* **Inno Setup Compiler** (for compiling `dev.iss`)
* Visual Studio Build Tools (C++)

### 1. Build the Tauri Application
Run the standard release build:
```bash
cargo tauri build
```
This compiles the web frontend into static assets and the Rust backend into a standalone optimized `.exe`.

### 2. Populate the Publish Directory
If it doesn't exist, create a folder named `publish` at the root of the project:
```bash
mkdir publish
```
Copy the generated executable and the multi-res icon into this folder:
```bash
# Example from PowerShell
Copy-Item "src-tauri\target\release\devnotes.exe" "publish\"
Copy-Item "src-tauri\icons\dev.ico" "publish\"
```

### 3. Compile the Installer
1. Open the **Inno Setup Compiler**.
2. Open `dev.iss` located in the root directory.
3. Click "Compile" (or press Ctrl+F9).
4. Inno Setup will output the final `DevNotes_Installer.exe` directly into the `publish` directory.

This `.exe` is now fully ready for distribution and guarantees pixel-perfect icons across the entire Windows shell interface.
