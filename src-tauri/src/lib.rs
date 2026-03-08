use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--autostarted"])))
        .setup(|app| {
            #[cfg(target_os = "windows")]
            { if let Some(win) = app.get_webview_window("main") { let _ = win.set_zoom(1.0); } }
            // Only set up tray if icon exists
            let _ = setup_tray(app);
            setup_window_close_behaviour(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_window, hide_window, get_app_data_path,
            wait_oauth_callback,
            watch_project_dir, stop_watching,
            register_global_hotkey, unregister_global_hotkey,
            open_path_in_explorer, run_shell_command,
        ])
        .run(tauri::generate_context!())
        .expect("error running DevNotes Desktop");
}

// ── OAuth callback ────────────────────────────────────────────────
#[tauri::command]
async fn wait_oauth_callback() -> Result<serde_json::Value, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    let listener = TcpListener::bind("127.0.0.1:42813").map_err(|e| format!("bind: {e}"))?;
    let (mut stream, _) = listener.accept().map_err(|e| format!("accept: {e}"))?;
    let req = BufReader::new(&stream).lines().next().ok_or("empty")?
        .map_err(|e| e.to_string())?;
    let path  = req.split_whitespace().nth(1).unwrap_or("/");
    let query = path.split('?').nth(1).unwrap_or("");
    let (mut code, mut state) = (String::new(), String::new());
    for p in query.split('&') {
        if let Some(v) = p.strip_prefix("code=")  { code  = v.to_string(); }
        if let Some(v) = p.strip_prefix("state=") { state = v.to_string(); }
    }
    let html = "<html><body style='background:#020202;color:#00ffff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column'><h1>CONNECTED</h1><p>Return to DevNotes.</p></body></html>";
    let _ = stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", html.len(), html).as_bytes());
    if code.is_empty() { return Err("no code".to_string()); }
    Ok(serde_json::json!({ "code": code, "state": state }))
}

// ── File watcher ──────────────────────────────────────────────────
#[tauri::command]
async fn watch_project_dir(app: tauri::AppHandle, project_id: String, dir_path: String) -> Result<(), String> {
    use std::collections::HashMap;
    use std::time::{Duration, SystemTime};
    use std::sync::{Arc, Mutex};
    let dir = dir_path.clone();
    let pid = project_id.clone();
    std::thread::spawn(move || {
        let state: Arc<Mutex<HashMap<String, SystemTime>>> = Arc::new(Mutex::new(HashMap::new()));
        loop {
            std::thread::sleep(Duration::from_secs(2));
            if !std::path::Path::new(&dir).exists() { break; }
            let mut current: HashMap<String, SystemTime> = HashMap::new();
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for e in entries.flatten() {
                    if let (Ok(meta), path) = (e.metadata(), e.path().to_string_lossy().to_string()) {
                        if let Ok(m) = meta.modified() { current.insert(path, m); }
                    }
                }
            }
            let mut prev = state.lock().unwrap();
            let changed = (!prev.is_empty()) && (
                current.iter().any(|(k,v)| prev.get(k) != Some(v)) ||
                prev.iter().any(|(k,_)| !current.contains_key(k))
            );
            if changed {
                let _ = app.emit("project-file-changed", serde_json::json!({ "projectId": pid, "path": dir }));
            }
            *prev = current;
        }
    });
    Ok(())
}

#[tauri::command]
async fn stop_watching(_dir_path: String) -> Result<(), String> { Ok(()) }

// ── Global hotkey ─────────────────────────────────────────────────
#[tauri::command]
async fn register_global_hotkey(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut("Ctrl+Shift+D", move |_app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if let Some(win) = handle.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) { let _ = win.hide(); }
                    else { let _ = win.show(); let _ = win.set_focus(); }
                }
            }
        })
        .map_err(|e| format!("hotkey: {e}"))
}

#[tauri::command]
async fn unregister_global_hotkey(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    app.global_shortcut().unregister("Ctrl+Shift+D").map_err(|e| format!("unreg: {e}"))
}

// ── Shell utilities ───────────────────────────────────────────────
#[tauri::command]
async fn open_path_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    let _ = path;
    Ok(())
}

#[tauri::command]
async fn run_shell_command(command: String, cwd: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", &command]);
        if let Some(dir) = cwd { cmd.current_dir(dir); }
        let out = cmd.output().map_err(|e| e.to_string())?;
        Ok(format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new("sh");
        cmd.args(["-c", &command]);
        if let Some(dir) = cwd { cmd.current_dir(dir); }
        let out = cmd.output().map_err(|e| e.to_string())?;
        Ok(format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)))
    }
}

// ── Window / tray ─────────────────────────────────────────────────
fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show DevNotes", true, None::<&str>)?;
    let sep  = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &sep, &quit])?;
    TrayIconBuilder::new()
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); } }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
                    else { let _ = w.show(); let _ = w.set_focus(); }
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn setup_window_close_behaviour<R: Runtime>(app: &tauri::App<R>) {
    let handle = app.app_handle().clone();
    if let Some(win) = app.get_webview_window("main") {
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Some(w) = handle.get_webview_window("main") { let _ = w.hide(); }
            }
        });
    }
}

#[tauri::command]
fn show_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); }
}

#[tauri::command]
fn get_app_data_path(app: tauri::AppHandle) -> String {
    app.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}
