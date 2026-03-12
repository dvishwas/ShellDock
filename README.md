# ShellDock

A multi-tab terminal manager built with Electron, React, and xterm.js. Features session recovery, configurable layout, and keyboard-driven navigation.

## Features

- **Multi-tab terminals** — open multiple terminal sessions in a single window
- **Session recovery** — tabs and state persist across restarts
- **Configurable tab position** — place tabs on the top, left, or right
- **Keyboard shortcuts** — fast tab management without leaving the keyboard
- **Bell notifications** — tabs with activity are promoted to the front
- **Right-click context menu** — copy, paste, select all, and clear
- **Auto-updates** — built-in update mechanism via `electron-updater`
- **Cross-platform** — builds for macOS, Windows, and Linux

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + T` | New tab |
| `Cmd/Ctrl + W` | Close current tab |
| `Cmd/Ctrl + Tab` | Next tab |
| `Cmd/Ctrl + Shift + Tab` | Previous tab |
| `Cmd/Ctrl + 1-9` | Switch to tab by number |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install & Run

```bash
npm install
npm start
```

### Development

```bash
npm run dev
```

This watches for source changes and launches Electron automatically.

### CLI

```bash
shelldock              # Launch ShellDock
shelldock --version    # Print version
shelldock --config     # Open config directory
shelldock --help       # Show help
```

## Configuration

ShellDock stores its configuration in the platform-specific app data directory:

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/shelldock/` |
| Windows | `%APPDATA%/shelldock/` |
| Linux | `~/.config/shelldock/` |

Options include shell path, font size, font family, tab position, and theme (dark/light).

## Building

```bash
npm run dist           # Build for current platform
npm run dist:mac       # macOS (.dmg)
npm run dist:win       # Windows (.exe, .msi)
npm run dist:linux     # Linux (.deb, .rpm, .AppImage, .snap)
npm run installer:mac  # macOS installer (.dmg + .zip)
```

### macOS Code Signing

The app requires an Apple Developer ID certificate for proper macOS integration (Spotlight indexing, Gatekeeper approval). To enable signing, update `electron-builder.yml`:

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  notarize:
    teamId: "TEAM_ID"
```

This requires an [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).

### Installing Unsigned Builds

Without code signing, recipients of the DMG need to run this once after dragging ShellDock to Applications:

```bash
xattr -cr /Applications/ShellDock.app
```

This removes the macOS quarantine flag. Note that unsigned builds will not appear in Spotlight.

## Tech Stack

- **Electron** — desktop shell
- **React** — UI
- **xterm.js** — terminal emulator
- **node-pty** — pseudo-terminal backend
- **esbuild** — bundler
- **electron-builder** — packaging and distribution

## License

MIT
