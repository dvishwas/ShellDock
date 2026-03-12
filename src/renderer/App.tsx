import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TabBar } from './components/TabBar';
import { TerminalPanel } from './components/TerminalPanel';
import { IPC, TabInfo, AppConfig, TabPosition, ThemeSetting, SessionState } from '../shared/types';

const { ipcRenderer } = window.require('electron');

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:renderer] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:renderer] ERROR: ${msg}`, ...args);

const DEFAULT_PANEL_SIZE: Record<TabPosition, number> = {
  left: 200,
  right: 200,
  top: 40,
};

const MIN_PANEL_SIZE: Record<TabPosition, number> = {
  left: 120,
  right: 120,
  top: 32,
};

const MAX_PANEL_SIZE: Record<TabPosition, number> = {
  left: 500,
  right: 500,
  top: 300,
};

export default function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>({
    tabPosition: 'top',
    shell: '/bin/zsh',
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: 'system',
  });
  const creatingTabRef = useRef(false);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [collapsed, setCollapsed] = useState(false);
  const [panelSize, setPanelSize] = useState<Record<TabPosition, number>>({ ...DEFAULT_PANEL_SIZE });
  const isDraggingRef = useRef(false);
  const appRef = useRef<HTMLDivElement>(null);

  // Listen for OS theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load initial config and session
  useEffect(() => {
    log('App mounted, loading session state');
    (async () => {
      try {
        const session: SessionState = await ipcRenderer.invoke(IPC.SESSION_GET);
        log('Session loaded:', session.tabs.length, 'tabs, config:', JSON.stringify(session.config));
        setConfig(session.config);
        if (session.tabs.length > 0) {
          // Spawn PTY processes for restored tabs before rendering them
          await ipcRenderer.invoke(IPC.SESSION_RESTORE);
          log('PTY sessions restored for saved tabs');
          setTabs(session.tabs);
          setActiveTabId(session.activeTabId || session.tabs[0].id);
        }
      } catch (err: any) {
        logError('Failed to load session:', err.message);
      }
    })();
  }, []);

  // Listen for session restoration
  useEffect(() => {
    const onRestored = (_event: any, restoredTabs: TabInfo[]) => {
      log('Sessions restored from main process:', restoredTabs.length, 'tabs');
      setTabs(restoredTabs);
      if (restoredTabs.length > 0 && !activeTabId) {
        setActiveTabId(restoredTabs[0].id);
      }
    };

    const onConfigChanged = (_event: any, newConfig: AppConfig) => {
      log('Config changed from main process:', JSON.stringify(newConfig));
      setConfig(newConfig);
    };

    const onBell = (_event: any, tabId: string) => {
      log('Bell received for tab:', tabId);
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab || tab.isActive) {
          log('Bell ignored (tab not found or is active)');
          return prev;
        }

        log('Promoting tab to front:', tabId, tab.name);
        const updated = prev.map((t) => (t.id === tabId ? { ...t, hasBell: true } : t));
        const bellTab = updated.find((t) => t.id === tabId)!;
        const others = updated.filter((t) => t.id !== tabId);
        const reordered = [bellTab, ...others].map((t, i) => ({ ...t, order: i }));
        return reordered;
      });
    };

    ipcRenderer.on(IPC.SESSION_RESTORED, onRestored);
    ipcRenderer.on(IPC.CONFIG_CHANGED, onConfigChanged);
    ipcRenderer.on(IPC.TAB_BELL, onBell);

    return () => {
      ipcRenderer.removeListener(IPC.SESSION_RESTORED, onRestored);
      ipcRenderer.removeListener(IPC.CONFIG_CHANGED, onConfigChanged);
      ipcRenderer.removeListener(IPC.TAB_BELL, onBell);
    };
  }, [activeTabId]);

  const createTab = useCallback(async () => {
    if (creatingTabRef.current) {
      log('Tab creation already in progress, skipping');
      return;
    }
    creatingTabRef.current = true;
    log('Creating new tab');
    try {
      const result = await ipcRenderer.invoke(IPC.TAB_CREATE);
      log('Tab created:', result.id, result.name);
      const newTab: TabInfo = {
        id: result.id,
        name: result.name,
        hasBell: false,
        isActive: true,
        order: tabs.length,
      };
      setTabs((prev) => [...prev.map((t) => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(result.id);
    } catch (err: any) {
      logError('Failed to create tab:', err.message);
    } finally {
      creatingTabRef.current = false;
    }
  }, [tabs.length]);

  // Listen for menu-triggered new tab
  useEffect(() => {
    const onMenuNewTab = () => {
      log('Menu: new tab triggered');
      createTab();
    };
    ipcRenderer.on(IPC.MENU_NEW_TAB, onMenuNewTab);
    return () => { ipcRenderer.removeListener(IPC.MENU_NEW_TAB, onMenuNewTab); };
  }, [createTab]);

  const closeTab = useCallback(
    async (tabId: string) => {
      log('Closing tab:', tabId);
      try {
        await ipcRenderer.invoke(IPC.TAB_CLOSE, tabId);
        setTabs((prev) => {
          const remaining = prev.filter((t) => t.id !== tabId);
          log('Tab closed, remaining:', remaining.length);
          if (activeTabId === tabId && remaining.length > 0) {
            setActiveTabId(remaining[0].id);
          } else if (remaining.length === 0) {
            setActiveTabId(null);
          }
          return remaining;
        });
      } catch (err: any) {
        logError('Failed to close tab:', err.message);
      }
    },
    [activeTabId],
  );

  const switchTab = useCallback((tabId: string) => {
    log('Switching to tab:', tabId);
    setActiveTabId(tabId);
    setTabs((prev) =>
      prev.map((t) => ({
        ...t,
        isActive: t.id === tabId,
        hasBell: t.id === tabId ? false : t.hasBell,
      })),
    );
  }, []);

  const renameTab = useCallback(async (tabId: string, name: string) => {
    log('Renaming tab:', tabId, 'to:', name);
    try {
      await ipcRenderer.invoke(IPC.TAB_RENAME, tabId, name);
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name } : t)));
    } catch (err: any) {
      logError('Failed to rename tab:', err.message);
    }
  }, []);

  const changeTabPosition = useCallback(async (position: TabPosition) => {
    log('Changing tab position to:', position);
    try {
      const updated = await ipcRenderer.invoke(IPC.CONFIG_SET, { tabPosition: position });
      setConfig(updated);
    } catch (err: any) {
      logError('Failed to change tab position:', err.message);
    }
  }, []);

  const changeTheme = useCallback(async (theme: ThemeSetting) => {
    log('Changing theme to:', theme);
    try {
      const updated = await ipcRenderer.invoke(IPC.CONFIG_SET, { theme });
      setConfig(updated);
    } catch (err: any) {
      logError('Failed to change theme:', err.message);
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Resize handle drag logic
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const pos = config.tabPosition;
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = panelSize[pos];

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        let newSize: number;
        if (pos === 'top') {
          newSize = startSize + (moveEvent.clientY - startY);
        } else if (pos === 'left') {
          newSize = startSize + (moveEvent.clientX - startX);
        } else {
          newSize = startSize - (moveEvent.clientX - startX);
        }
        newSize = Math.max(MIN_PANEL_SIZE[pos], Math.min(MAX_PANEL_SIZE[pos], newSize));
        setPanelSize((prev) => ({ ...prev, [pos]: newSize }));
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = pos === 'top' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [config.tabPosition, panelSize],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 't') {
        e.preventDefault();
        log('Keyboard shortcut: new tab');
        createTab();
      } else if (mod && e.key === 'w') {
        e.preventDefault();
        log('Keyboard shortcut: close tab');
        if (activeTabId) closeTab(activeTabId);
      } else if (mod && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex((t) => t.id === activeTabId);
          const nextIdx = e.shiftKey
            ? (idx - 1 + tabs.length) % tabs.length
            : (idx + 1) % tabs.length;
          log('Keyboard shortcut: switch tab', e.shiftKey ? 'prev' : 'next');
          switchTab(tabs[nextIdx].id);
        }
      } else if (mod && e.key === 'b') {
        e.preventDefault();
        log('Keyboard shortcut: toggle panel collapse');
        toggleCollapse();
      } else if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) {
          log('Keyboard shortcut: switch to tab', idx + 1);
          switchTab(tabs[idx].id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId, createTab, closeTab, switchTab, toggleCollapse]);

  const flexDirection =
    config.tabPosition === 'top' ? 'column' : config.tabPosition === 'left' ? 'row' : 'row-reverse';

  const pos = config.tabPosition;
  const isVertical = pos === 'left' || pos === 'right';
  const tabBarStyle: React.CSSProperties = collapsed
    ? {}
    : isVertical
      ? { width: panelSize[pos] }
      : { height: panelSize[pos] };

  const resizeCursor = isVertical ? 'col-resize' : 'row-resize';
  const resolvedTheme = config.theme === 'system' ? systemTheme : config.theme;

  return (
    <div ref={appRef} className={`app theme-${resolvedTheme}`} style={{ flexDirection }}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        position={config.tabPosition}
        collapsed={collapsed}
        themeSetting={config.theme}
        onToggleCollapse={toggleCollapse}
        onCreateTab={createTab}
        onCloseTab={closeTab}
        onSwitchTab={switchTab}
        onRenameTab={renameTab}
        onChangePosition={changeTabPosition}
        onChangeTheme={changeTheme}
        {...(!collapsed && { style: tabBarStyle })}
      />
      {!collapsed && (
        <div
          className={`resize-handle resize-handle-${pos}`}
          style={{ cursor: resizeCursor }}
          onMouseDown={handleResizeStart}
        />
      )}
      <div className="terminal-area">
        {tabs.map((tab) => (
          <TerminalPanel
            key={tab.id}
            tabId={tab.id}
            isVisible={tab.id === activeTabId}
            fontSize={config.fontSize}
            fontFamily={config.fontFamily}
            theme={resolvedTheme}
          />
        ))}
        {tabs.length === 0 && (
          <div className="empty-state">
            <h2>ShellDock</h2>
            <p>
              Press <kbd>Cmd+T</kbd> or click <strong>+</strong> to create a new terminal tab
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
