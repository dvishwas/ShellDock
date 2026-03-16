import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { setupIpcHandlers, setMainWindow, saveScrollbackToDisk } from './ipc-handlers';
import { killAllSessions } from './pty-manager';
import { getConfig } from './config-store';
import { IPC } from '../shared/types';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:main] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:main] ERROR: ${msg}`, ...args);

// Prevent EIO errors from crashing the app when PTY processes exit
process.on('uncaughtException', (err) => {
  if (err.message.includes('EIO')) {
    log('Suppressed PTY EIO error:', err.message);
  } else {
    logError('Uncaught exception:', err.message);
    throw err;
  }
});

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  log('Creating main window');
  const config = getConfig();
  log('Loaded config:', JSON.stringify(config));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'ShellDock',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  setMainWindow(mainWindow);

  const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
  log('Loading renderer from:', rendererPath);
  mainWindow.loadFile(rendererPath);

  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    log('Opening external URL:', url);
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('Renderer finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logError('Renderer failed to load:', errorCode, errorDescription);
  });

  log('Main window created successfully');
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(IPC.MENU_NEW_TAB);
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  log('Application menu built');
}

app.whenReady().then(() => {
  log('App ready, platform:', process.platform, 'electron:', process.versions.electron);

  setupIpcHandlers();
  createWindow();
  buildMenu();
  setupAutoUpdater();

  app.on('activate', () => {
    log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function setupAutoUpdater(): void {
  log('Setting up auto-updater');
  autoUpdater.logger = {
    info: (msg: any) => log('updater:info', msg),
    warn: (msg: any) => log('updater:warn', msg),
    error: (msg: any) => logError('updater:error', msg),
    debug: (msg: any) => log('updater:debug', msg),
  };

  autoUpdater.on('checking-for-update', () => log('Checking for updates...'));
  autoUpdater.on('update-available', (info) => log('Update available:', JSON.stringify(info)));
  autoUpdater.on('update-not-available', () => log('No updates available'));
  autoUpdater.on('download-progress', (progress) => log('Download progress:', Math.round(progress.percent) + '%'));
  autoUpdater.on('update-downloaded', (info) => {
    log('Update downloaded:', JSON.stringify(info));
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `ShellDock v${info.version} has been downloaded. Restart to apply.`,
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) {
        log('User chose to restart for update');
        autoUpdater.quitAndInstall();
      } else {
        log('User deferred update');
      }
    });
  });
  autoUpdater.on('error', (err) => logError('Auto-update error:', err.message));

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    logError('Failed to check for updates:', err.message);
  });
}

app.on('window-all-closed', () => {
  log('All windows closed, saving scrollback and cleaning up PTY processes');
  saveScrollbackToDisk();
  killAllSessions();
  if (process.platform !== 'darwin') {
    log('Quitting app (non-macOS)');
    app.quit();
  }
});

app.on('before-quit', () => {
  log('Before quit, saving scrollback and killing PTY processes');
  saveScrollbackToDisk();
  killAllSessions();
});
