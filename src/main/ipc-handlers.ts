import { ipcMain, BrowserWindow } from 'electron';
import { IPC, TabInfo, TabCreateResult } from '../shared/types';
import * as ptyManager from './pty-manager';
import * as config from './config-store';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:ipc] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:ipc] ERROR: ${msg}`, ...args);

let mainWindow: BrowserWindow | null = null;

const MAX_SCROLLBACK = 100_000; // characters per tab
const scrollbackBuffers = new Map<string, string>();

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
  log('Main window reference set');
}

function sendToRenderer(channel: string, ...args: any[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  } else {
    logError('Cannot send to renderer, window is null or destroyed. Channel:', channel);
  }
}

function handleTabData(tabId: string, data: string): void {
  sendToRenderer(IPC.TAB_OUTPUT, tabId, data);

  // Buffer output for session recovery
  const existing = scrollbackBuffers.get(tabId) || '';
  let updated = existing + data;
  if (updated.length > MAX_SCROLLBACK) {
    updated = updated.slice(-MAX_SCROLLBACK);
  }
  scrollbackBuffers.set(tabId, updated);

  // Detect bell character
  if (data.includes('\x07')) {
    log('Bell detected in tab:', tabId);
    sendToRenderer(IPC.TAB_BELL, tabId);
  }
}

function handleTabExit(tabId: string): void {
  log('Tab process exited:', tabId);
  const tabs = config.getSavedTabs().filter((t) => t.id !== tabId);
  config.saveTabs(tabs);
  scrollbackBuffers.delete(tabId);
  config.clearScrollback(tabId);
  config.clearCwd(tabId);
  sendToRenderer(IPC.TAB_DATA, tabs);
}

export function setupIpcHandlers(): void {
  log('Setting up IPC handlers');

  ipcMain.handle(IPC.TAB_CREATE, async (): Promise<TabCreateResult> => {
    log('IPC: tab:create requested');
    try {
      const session = ptyManager.createSession(handleTabData, handleTabExit);
      const tabs = config.getSavedTabs();
      const newTab: TabInfo = {
        id: session.id,
        name: `Terminal ${tabs.length + 1}`,
        hasBell: false,
        isActive: true,
        order: tabs.length,
      };

      const updatedTabs = tabs.map((t) => ({ ...t, isActive: false }));
      updatedTabs.push(newTab);
      config.saveTabs(updatedTabs);
      config.setActiveTabId(session.id);

      log('Tab created:', newTab.id, newTab.name);
      return { id: session.id, name: newTab.name };
    } catch (err: any) {
      logError('Failed to create tab:', err.message);
      throw err;
    }
  });

  ipcMain.handle(IPC.TAB_CLOSE, async (_event, tabId: string): Promise<void> => {
    log('IPC: tab:close requested for:', tabId);
    ptyManager.killSession(tabId);
    const tabs = config.getSavedTabs().filter((t) => t.id !== tabId);
    config.saveTabs(tabs);
    log('Tab closed, remaining tabs:', tabs.length);
  });

  ipcMain.on(IPC.TAB_INPUT, (_event, tabId: string, data: string) => {
    ptyManager.writeToSession(tabId, data);
  });

  ipcMain.on(IPC.TAB_RESIZE, (_event, tabId: string, cols: number, rows: number) => {
    log('IPC: tab:resize for', tabId, ':', cols, 'x', rows);
    ptyManager.resizeSession(tabId, cols, rows);
  });

  ipcMain.handle(IPC.TAB_RENAME, async (_event, tabId: string, name: string): Promise<void> => {
    log('IPC: tab:rename', tabId, 'to:', name);
    const tabs = config.getSavedTabs().map((t) => (t.id === tabId ? { ...t, name } : t));
    config.saveTabs(tabs);
  });

  ipcMain.handle(
    IPC.TAB_REORDER,
    async (_event, tabIds: string[]): Promise<void> => {
      log('IPC: tab:reorder, new order:', tabIds);
      const tabs = config.getSavedTabs();
      const reordered = tabIds
        .map((id, index) => {
          const tab = tabs.find((t) => t.id === id);
          return tab ? { ...tab, order: index } : null;
        })
        .filter(Boolean) as TabInfo[];
      config.saveTabs(reordered);
    },
  );

  ipcMain.handle(IPC.CONFIG_GET, async () => {
    log('IPC: config:get');
    return config.getConfig();
  });

  ipcMain.handle(IPC.CONFIG_SET, async (_event, partial) => {
    log('IPC: config:set', JSON.stringify(partial));
    const updated = config.setConfig(partial);
    sendToRenderer(IPC.CONFIG_CHANGED, updated);
    return updated;
  });

  ipcMain.handle(IPC.SESSION_GET, async () => {
    log('IPC: session:get');
    const state = config.getSessionState();
    log('Session state:', state.tabs.length, 'saved tabs, activeTabId:', state.activeTabId);
    return state;
  });

  ipcMain.handle(IPC.SESSION_RESTORE, async () => {
    log('IPC: session:restore');
    const savedTabs = config.getSavedTabs();
    log('Restoring PTY sessions for', savedTabs.length, 'saved tabs');
    for (const tab of savedTabs) {
      if (!ptyManager.getSession(tab.id)) {
        const cwd = config.getCwd(tab.id);
        log('Spawning PTY for restored tab:', tab.id, tab.name, 'cwd:', cwd || '(default)');
        ptyManager.createSessionWithId(tab.id, handleTabData, handleTabExit, cwd || undefined);
      }
    }
    return savedTabs;
  });

  ipcMain.handle(IPC.TAB_GET_SCROLLBACK, async (_event, tabId: string): Promise<string> => {
    log('IPC: tab:get-scrollback for:', tabId);
    return config.getScrollback(tabId);
  });

  log('All IPC handlers registered');
}

export function saveScrollbackToDisk(): void {
  const obj: Record<string, string> = {};
  for (const [id, buf] of scrollbackBuffers) {
    obj[id] = buf;
  }
  config.saveScrollback(obj);

  // Save current working directories for all sessions
  const cwds = ptyManager.getAllSessionCwds();
  config.saveCwds(cwds);
}
