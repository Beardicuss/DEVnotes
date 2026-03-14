![dev](src-tauri/icons/dev.png)

# DevNotes Desktop

A streamlined, robust desktop experience for managing your DEVnotes projects, built by **Softcurse Studio**. DevNotes is a unified workspace that replaces your scattered tools with an all-in-one project manager, specifically tailored for developers.

## 🚀 Key Features

- **Project Management**: Organize tasks, milestones, and daily standups in one unified dashboard.
- **Interactive Mind Maps**: Visually brainstorm architecture and ideas using integrated interactive flowcharts.
- **AI Assistant**: Built-in Anthropic Claude integration. Draft standups, summarize notes, auto-tag, and break down goals into subtasks without leaving your IDE context.
- **GitHub Sync**: Turn GitHub into a free cloud backup service. Securely sync your encrypted workspace data to a private GitHub Gist, allowing you to seamlessly work across multiple machines.
- **Google Calendar Integration**: Two-way sync with Google Calendar. Set a due time on a task and watch the event magically appear on your schedule.
- **Built for Speed**: Native Windows integration with system tray support, global shortcuts, and lightning-fast Rust-powered backend.

## 🛠 Architecture & Tech Stack

This project utilizes a modern, hyper-optimized stack:
- **Frontend**: React 18, Vite, Zustand (State Management)
- **Backend / Desktop Frame**: Tauri v2, Rust
- **Installer Framework**: Inno Setup

For comprehensive instructions on how to build, package, and generate identical Windows icons using our custom Publishing architecture, please see [INSTALLER.md](./INSTALLER.md).

## 📥 Requirements

Please see [requirements.txt](./requirements.txt) for the exact system prerequisites required to build and run this application locally.
