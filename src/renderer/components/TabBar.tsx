import React from 'react';
import { Tab } from './Tab';
import { TabInfo, TabPosition } from '../../shared/types';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  position: TabPosition;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSwitchTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onChangePosition: (position: TabPosition) => void;
  style?: React.CSSProperties;
}

export function TabBar({
  tabs,
  activeTabId,
  position,
  collapsed,
  onToggleCollapse,
  onCreateTab,
  onCloseTab,
  onSwitchTab,
  onRenameTab,
  onChangePosition,
  style,
}: TabBarProps) {
  const sorted = [...tabs].sort((a, b) => a.order - b.order);
  const isVertical = position === 'left' || position === 'right';

  const collapseIcon = position === 'top'
    ? (collapsed ? '\u25BC' : '\u25B2')
    : position === 'left'
      ? (collapsed ? '\u25B6' : '\u25C0')
      : (collapsed ? '\u25C0' : '\u25B6');

  return (
    <div className={`tab-bar tab-bar-${position}${collapsed ? ' tab-bar-collapsed' : ''}`} style={style}>
      <div className="tab-bar-header">
        <span className="tab-bar-title">{collapsed && isVertical ? 'SD' : 'ShellDock'}</span>
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
