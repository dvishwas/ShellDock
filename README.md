# ShellDock

A multi-tab terminal manager for macOS, Windows, and Linux, built with Electron, React, and xterm.js.

## Features

- **Multi-tab terminals** — open several shell sessions in a single window and switch between them instantly
- **Session recovery** — on launch, tabs, the active tab, per-tab scrollback, and each tab's working directory are restored
- **Configurable tab position** — dock the tab bar to the top, left, or right, and drag the resize handle to size it
- **Collapsible tab bar** — hide the tab bar entirely to maximize terminal space
- **Keyboard shortcuts** — create, close, and switch tabs without leaving the keyboard
- **Bell notifications** — a background tab that emits `\x07` is flagged and promoted to the front
- **Terminal context menu** — right-click for Copy, Paste, Select All, and Clear
- **Tab context menu** — right-click a tab for Rename Tab and Close Tab; double-clicking a tab also renames it
- **Drag-and-drop paths** — drop files onto a terminal to insert their quoted paths
- **Themes** — dark, light, or follow the OS appearance
- **Cross-platform** — builds for macOS, Windows, and Linux

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + T` | New tab |
| `Cmd/Ctrl + W` | Close current tab |
| `Cmd/Ctrl + Tab` | Next tab |
| `Cmd/Ctrl + Shift + Tab` | Previous tab |
| `Cmd/Ctrl + B` | Collapse / expand the tab bar |
| `Cmd/Ctrl + 1-9` | Switch to tab by number |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

The terminal backend is the native `node-pty` module, so `npm install` runs the `postinstall` hook (`npx electron-rebuild`) to rebuild it against the installed Electron version.

### Install & Run

```bash
npm install
npm start
```

`npm start` bundles the main and renderer sources with esbuild into `dist/` and then launches Electron.

### Development

```bash
npm run dev
```

`npm run dev` runs the esbuild watcher for both the main and renderer bundles, waits until `dist/main/index.js` and `dist/renderer/index.html` exist, and then launches Electron once. Restart the command to pick up main-process changes; renderer changes are picked up on the next launch. There is no hot-reload/HMR, and the project has no test suite and no `test` script.

### CLI

```bash
shelldock              # Launch ShellDock
shelldock --version    # Print version
shelldock --config     # Print and open the config directory
shelldock --help       # Show help
```

`bin/shelldock` launches Electron from `node_modules/.bin/electron` inside its own checkout, so it requires a cloned repository with dependencies installed (`npm link` makes `shelldock` available on your `PATH`).

## Configuration

Preferences are reachable from the ShellDock title menu in the tab bar.

| Key | Default | Values |
|---|---|---|
| `tabPosition` | `top` | `top`, `left`, `right` |
| `shell` | `$SHELL` (falls back to `/bin/zsh`); `powershell.exe` / `%COMSPEC%` on Windows | any executable path |
| `fontSize` | `14` | pixel size |
| `fontFamily` | `Menlo, Monaco, "Courier New", monospace` | any CSS font stack |
| `theme` | `system` | `dark`, `light`, `system` |

Shells are launched with `--login`. The `system` theme follows the OS appearance via `prefers-color-scheme`.

### Config file location

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/shelldock/` |
| Windows | `%APPDATA%/shelldock/` |
| Linux | `~/.config/shelldock/` |

Settings are stored by `electron-store` in `config.json`, alongside the persisted `tabs`, `activeTabId`, `scrollback`, and `cwds` keys used for session recovery.

## Project Structure

```text
ShellDock/
├── src/
│   ├── main/                  # Electron main process (Node.js)
│   │   ├── index.ts           # app lifecycle, window, menu, auto-updater
│   │   ├── ipc-handlers.ts    # IPC registration + per-tab scrollback buffering
│   │   ├── pty-manager.ts     # node-pty session creation and teardown
│   │   └── config-store.ts    # electron-store persistence
│   ├── renderer/              # React UI
│   │   ├── App.tsx            # tab state, keyboard shortcuts, theme resolution
│   │   ├── index.tsx          # React entry point
│   │   ├── index.html         # window document + CSP meta tag
│   │   ├── components/
│   │   │   ├── Tab.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── TerminalPanel.tsx
│   │   ├── hooks/useTerminal.ts
│   │   └── styles/global.css
│   └── shared/types.ts        # shared types + IPC channel constants
├── scripts/
│   ├── build.js               # esbuild bundler for main and renderer
│   ├── build-macos-installer.sh
│   └── generate-icon.sh
├── bin/shelldock              # CLI entry point (npm `bin`)
├── assets/                    # application icons
├── electron-builder.yml       # packaging configuration
├── dist/                      # build output (git-ignored)
└── release/                   # packaged artifacts (git-ignored)
```

## Architecture

The main process owns everything privileged: it spawns PTYs through `node-pty`, buffers scrollback, and persists state with `electron-store`. The renderer never touches `node-pty` directly; it renders xterm.js terminals and talks to main over IPC in three groups:

- **Tab lifecycle** — `tab:create`, `tab:close`, `tab:rename`, `tab:reorder`
- **Terminal I/O** — `tab:input`, `tab:output`, `tab:resize`, `tab:get-scrollback`, plus `tab:bell`
- **Config and session** — `config:get`, `config:set`, `config:changed`, `session:get`, `session:restore`

**Security note:** the window is created with `nodeIntegration: true` and `contextIsolation: false` so the renderer can `window.require('electron')` and use `ipcRenderer` directly. A strict Content-Security-Policy meta tag is set in `src/renderer/index.html`.

## Building & Packaging

| Script | Purpose |
|---|---|
| `npm run build` | Bundle main and renderer with esbuild into `dist/` |
| `npm start` | Build, then launch Electron |
| `npm run dev` | Watch mode plus a single Electron launch |
| `npm run pack` | `electron-builder --dir` — unpacked app for local inspection |
| `npm run dist` | Package for the current platform |
| `npm run dist:mac` / `dist:win` / `dist:linux` | Package for a specific platform |
| `npm run installer:mac` | Run `scripts/build-macos-installer.sh` |

Artifacts are written to `release/`, using `appId: com.shelldock.app` and `productName: ShellDock` from `electron-builder.yml`:

| Platform | Artifacts |
|---|---|
| macOS | `.dmg` and `.zip` |
| Windows | NSIS installer `.exe` and portable `.exe` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

CI (`.github/workflows/build.yml`) builds on macOS, Ubuntu, and Windows with Node.js 20 for pushes to `main`, pull requests to `main`, and `v*` tags; tag builds attach the artifacts to a GitHub Release.

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

## Troubleshooting

- **Logs** — every layer prefixes its log lines, so filter the console output by `[ShellDock:main]`, `[ShellDock:ipc]`, `[ShellDock:pty]`, `[ShellDock:config]`, `[ShellDock:renderer]`, `[ShellDock:terminal]`, `[ShellDock:tab]`, or `[ShellDock:panel]`.
- **`EIO` errors in the console** — expected. PTY `EIO` errors are deliberately suppressed so a shell exiting does not crash the app.
- **Stale tabs or session state** — quit ShellDock and delete (or fix) `config.json` in the config directory listed above.
- **`npm start` fails with a native module error** — `node-pty` was not rebuilt; rerun `npm install` so the `postinstall` hook (`electron-rebuild`) runs.
- **Update checks** — updates go through `electron-updater`; the packaged build ships with `publish: null`, so a publish provider must be configured before updates can be distributed.

## Tech Stack

- **Electron** — desktop shell
- **React** — UI
- **TypeScript** — application and UI code
- **xterm.js** — terminal emulator
- **node-pty** — pseudo-terminal backend
- **electron-store** — configuration and session persistence
- **electron-updater** — update checks
- **uuid** — tab session IDs
- **esbuild** — bundler
- **electron-builder** — packaging and distribution

## License

MIT — see `package.json`.
