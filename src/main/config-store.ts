import Store from 'electron-store';
import { AppConfig, SessionState, TabInfo, TabPosition } from '../shared/types';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:config] ${msg}`, ...args);

const defaultShell = (): string => {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
};

const defaultConfig: AppConfig = {
  tabPosition: 'top',
  shell: defaultShell(),
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: 'system',
};

log('Initializing config store');

const store = new Store<{
  config: AppConfig;
  tabs: TabInfo[];
  activeTabId: string | null;
  scrollback: Record<string, string>;
}>({
  defaults: {
    config: defaultConfig,
    tabs: [],
    activeTabId: null,
    scrollback: {},
  },
});

log('Config store path:', store.path);

export function getConfig(): AppConfig {
  return store.get('config');
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  const updated = { ...current, ...partial };
  store.set('config', updated);
  log('Config updated:', JSON.stringify(partial));
  return updated;
}

export function getSavedTabs(): TabInfo[] {
  return store.get('tabs');
}

export function saveTabs(tabs: TabInfo[]): void {
  store.set('tabs', tabs);
  log('Saved', tabs.length, 'tabs to store');
}

export function getActiveTabId(): string | null {
  return store.get('activeTabId');
}

export function setActiveTabId(id: string | null): void {
  store.set('activeTabId', id);
  log('Active tab ID set to:', id);
}

export function getScrollback(tabId: string): string {
  const all = store.get('scrollback');
  return all[tabId] || '';
}

export function saveScrollback(scrollback: Record<string, string>): void {
  store.set('scrollback', scrollback);
  log('Saved scrollback for', Object.keys(scrollback).length, 'tabs');
}

export function clearScrollback(tabId: string): void {
  const all = store.get('scrollback');
  delete all[tabId];
  store.set('scrollback', all);
}

export function getSessionState(): SessionState {
  return {
    tabs: getSavedTabs(),
    activeTabId: getActiveTabId(),
    config: getConfig(),
  };
}
