import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTerminal } from '../hooks/useTerminal';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:panel] ${msg}`, ...args);

interface TerminalPanelProps {
  tabId: string;
  isVisible: boolean;
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light';
}

export function TerminalPanel({ tabId, isVisible, fontSize, fontFamily, theme }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalRef } = useTerminal(tabId, containerRef, { fontSize, fontFamily, theme });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isVisible && terminalRef.current) {
      terminalRef.current.focus();
      const event = new Event('resize');
      window.dispatchEvent(event);
    }
  }, [isVisible]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (contextMenu) {
      const handler = () => setContextMenu(null);
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    log('Context menu opened for tab:', tabId);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [tabId]);

  const handleCopy = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      const selection = terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        log('Copied selection to clipboard, length:', selection.length);
      }
    }
    setContextMenu(null);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const terminal = terminalRef.current;
      if (terminal && text) {
        terminal.paste(text);
        log('Pasted from clipboard, length:', text.length);
      }
    } catch (err: any) {
      log('Paste failed:', err.message);
    }
    setContextMenu(null);
  }, []);

  const handleClear = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.clear();
      log('Terminal cleared for tab:', tabId);
    }
    setContextMenu(null);
  }, [tabId]);

  const handleSelectAll = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.selectAll();
      log('Selected all text in tab:', tabId);
    }
    setContextMenu(null);
  }, [tabId]);

  return (
    <div
      ref={containerRef}
      className={`terminal-panel ${isVisible ? 'terminal-visible' : 'terminal-hidden'}`}
      onContextMenu={handleContextMenu}
    >
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={handleCopy}>Copy</div>
          <div className="context-menu-item" onClick={handlePaste}>Paste</div>
          <div className="context-menu-item" onClick={handleSelectAll}>Select All</div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={handleClear}>Clear</div>
        </div>
      )}
    </div>
  );
}
