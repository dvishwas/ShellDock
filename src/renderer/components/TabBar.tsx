import React from 'react';
import { Tab } from './Tab';
import { TabInfo, TabPosition } from '../../shared/types';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  position: TabPosition;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSwitchTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onChangePosition: (position: TabPosition) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  position,
  onCreateTab,
  onCloseTab,
  onSwitchTab,
  onRenameTab,
  onChangePosition,
}: TabBarProps) {
  const sorted = [...tabs].sort((a, b) => a.order - b.order);
  const isVertical = position === 'left' || position === 'right';

  return (
    <div className={`tab-bar tab-bar-${position}`}>
      <div className="tab-bar-header">
        <span className="tab-bar-title">ShellDock</span>
        <div className="tab-bar-controls">
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
        </div>
      </div>

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
    </div>
  );
}
