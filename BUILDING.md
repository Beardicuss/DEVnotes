# Building DevNotes Desktop — Windows Installer

## Prerequisites (install once)

### 1. Rust
```
https://rustup.rs  →  download and run rustup-init.exe
```
During install, accept defaults. Then add Windows target:
```
rustup target add x86_64-pc-windows-msvc
```

### 2. Node.js (v18 or v20)
```
https://nodejs.org  →  download Windows LTS installer
```

### 3. WebView2 Runtime (usually already on Windows 10/11)
If not installed: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 4. Visual Studio Build Tools (C++ compiler)
```
https://visualstudio.microsoft.com/visual-cpp-build-tools/
```
Select: "Desktop development with C++"

### 5. Tauri CLI
```
cargo install tauri-cli --version "^2.0"
```

---

## Build Steps

```bash
# 1. Enter project folder
cd devnotes-desktop

# 2. Install JS dependencies
npm install

# 3. Build the installer
cargo tauri build
```

The NSIS installer will be at:
```
src-tauri/target/release/bundle/nsis/DevNotes Desktop_1.0.0_x64-setup.exe
```

---

## Running in Dev Mode (browser, no install needed)
```bash
npm install
npm run dev
# Open http://localhost:1420 in browser
```

## Running Tauri Dev (native window, hot-reload)
```bash
npm install
cargo tauri dev
```

---

## Troubleshooting

**"error: failed to run custom build command for `devnotes`"**
→ Make sure Visual Studio Build Tools (C++) are installed.

**"WebView2 not found"**  
→ Install the WebView2 Runtime from the link above.

**"icons/icon.ico not found"**  
→ The `src-tauri/icons/` folder must contain all icon files (already included).

**Slow first build**  
→ Rust downloads and compiles all dependencies (~5-10 min first time, fast after).
