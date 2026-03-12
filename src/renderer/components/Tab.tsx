import React, { useState, useRef, useEffect } from 'react';
import { TabInfo } from '../../shared/types';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:tab] ${msg}`, ...args);

interface TabProps {
  tab: TabInfo;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
}

export function Tab({ tab, isActive, onSwitch, onClose, onRename }: TabProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (showContextMenu) {
      const handler = () => setShowContextMenu(false);
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [showContextMenu]);

  const startEditing = () => {
    log('Start editing tab name:', tab.id, tab.name);
    setEditValue(tab.name);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.name) {
      log('Committing tab rename:', tab.id, tab.name, '->', trimmed);
      onRename(trimmed);
    } else {
      log('Tab rename cancelled or unchanged:', tab.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    log('Tab context menu opened:', tab.id, tab.name);
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <>
      <div
        className={`tab ${isActive ? 'tab-active' : ''} ${tab.hasBell ? 'tab-bell' : ''}`}
        onClick={onSwitch}
        onDoubleClick={startEditing}
        onContextMenu={handleContextMenu}
      >
        {tab.hasBell && <span className="bell-icon" title="Bell">&#x1F514;</span>}
        {editing ? (
          <input
            ref={inputRef}
            className="tab-name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tab-name">{tab.name}</span>
        )}
        <button
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close tab"
        >
          &times;
        </button>
      </div>

      {showContextMenu && (
        <div
          className="context-menu"
          style={{ left: contextPos.x, top: contextPos.y }}
        >
          <div className="context-menu-item" onClick={startEditing}>
            Rename Tab
          </div>
          <div className="context-menu-item" onClick={onClose}>
            Close Tab
          </div>
        </div>
      )}
    </>
  );
}
