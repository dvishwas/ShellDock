import React, { useState, useRef, useEffect } from 'react';
import { Tab } from './Tab';
import { TabInfo, TabPosition, ThemeSetting } from '../../shared/types';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  position: TabPosition;
  collapsed: boolean;
  themeSetting: ThemeSetting;
  onToggleCollapse: () => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSwitchTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onChangePosition: (position: TabPosition) => void;
  onChangeTheme: (theme: ThemeSetting) => void;
  style?: React.CSSProperties;
}

export function TabBar({
  tabs,
  activeTabId,
  position,
  collapsed,
  themeSetting,
  onToggleCollapse,
  onCreateTab,
  onCloseTab,
  onSwitchTab,
  onRenameTab,
  onChangePosition,
  onChangeTheme,
  style,
}: TabBarProps) {
  const sorted = [...tabs].sort((a, b) => a.order - b.order);
  const isVertical = position === 'left' || position === 'right';
  const [showMenu, setShowMenu] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const collapseIcon = position === 'top'
    ? (collapsed ? '\u25BC' : '\u25B2')
    : position === 'left'
      ? (collapsed ? '\u25B6' : '\u25C0')
      : (collapsed ? '\u25C0' : '\u25B6');

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowPrefs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const themeOptions: { value: ThemeSetting; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <div className={`tab-bar tab-bar-${position}${collapsed ? ' tab-bar-collapsed' : ''}`} style={style}>
      <div className="tab-bar-header">
        <div className="title-menu-wrapper" ref={menuRef}>
          <span
            className="tab-bar-title tab-bar-title-clickable"
            onClick={() => { setShowMenu((v) => !v); setShowPrefs(false); }}
          >
            {collapsed && isVertical ? 'SD' : 'ShellDock'}
          </span>
          {showMenu && (
            <div className="shelldock-menu">
              <div
                className="shelldock-menu-item"
                onClick={() => { setShowPrefs((v) => !v); }}
              >
                Preferences
                <span className="menu-arrow">{showPrefs ? '\u25C0' : '\u25B6'}</span>
              </div>
              {showPrefs && (
                <div className="prefs-submenu">
                  <div className="prefs-section-title">Theme</div>
                  {themeOptions.map((opt) => (
                    <div
                      key={opt.value}
                      className={`shelldock-menu-item${themeSetting === opt.value ? ' menu-item-active' : ''}`}
                      onClick={() => {
                        onChangeTheme(opt.value);
                        setShowMenu(false);
                        setShowPrefs(false);
                      }}
                    >
                      {themeSetting === opt.value && <span className="menu-check">&#10003;</span>}
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="tab-bar-controls">
          {!collapsed && (
            <select
              className="position-select"
              value={position}
              onChange={(e) => onChangePosition(e.target.value as TabPosition)}
              title="Tab position"
            >
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          )}
          <button
            className="collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand panel (Cmd+B)' : 'Collapse panel (Cmd+B)'}
          >
            {collapseIcon}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className={`tab-list ${isVertical ? 'tab-list-vertical' : 'tab-list-horizontal'}`}>
            {sorted.map((tab) => (
              <Tab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={() => onSwitchTab(tab.id)}
                onClose={() => onCloseTab(tab.id)}
                onRename={(name) => onRenameTab(tab.id, name)}
              />
            ))}
          </div>

          <button className="new-tab-btn" onClick={onCreateTab} title="New Tab (Cmd+T)">
            +
          </button>
        </>
      )}
    </div>
  );
}
