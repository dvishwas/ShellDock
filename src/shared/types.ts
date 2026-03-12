export type TabPosition = 'left' | 'top' | 'right';

export interface TabInfo {
  id: string;
  name: string;
  hasBell: boolean;
  isActive: boolean;
  order: number;
}

export interface AppConfig {
  tabPosition: TabPosition;
  shell: string;
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light';
}

export interface SessionState {
  tabs: TabInfo[];
  activeTabId: string | null;
  config: AppConfig;
}

// IPC channel names
export const IPC = {
  // Main -> Renderer
  TAB_DATA: 'tab:data',
  TAB_OUTPUT: 'tab:output',
  TAB_BELL: 'tab:bell',
  SESSION_RESTORED: 'session:restored',
  CONFIG_CHANGED: 'config:changed',

  // Renderer -> Main
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_INPUT: 'tab:input',
  TAB_RESIZE: 'tab:resize',
  TAB_RENAME: 'tab:rename',
  TAB_REORDER: 'tab:reorder',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  SESSION_GET: 'session:get',
  SESSION_RESTORE: 'session:restore',
} as const;

export interface TabCreateResult {
  id: string;
  name: string;
}
