import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { IPC } from '../../shared/types';

const { ipcRenderer } = window.require('electron');

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:terminal] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:terminal] ERROR: ${msg}`, ...args);

interface TerminalOptions {
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light';
}

const darkTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

const lightTheme = {
  background: '#eff1f5',
  foreground: '#4c4f69',
  cursor: '#dc8a78',
  cursorAccent: '#eff1f5',
  selectionBackground: '#acb0be',
  black: '#5c5f77',
  red: '#d20f39',
  green: '#40a02b',
  yellow: '#df8e1d',
  blue: '#1e66f5',
  magenta: '#ea76cb',
  cyan: '#179299',
  white: '#acb0be',
  brightBlack: '#6c6f85',
  brightRed: '#d20f39',
  brightGreen: '#40a02b',
  brightYellow: '#df8e1d',
  brightBlue: '#1e66f5',
  brightMagenta: '#ea76cb',
  brightCyan: '#179299',
  brightWhite: '#bcc0cc',
};

export function useTerminal(
  tabId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: TerminalOptions,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      logError('Container ref is null for tab:', tabId);
      return;
    }

    log('Initializing xterm.js for tab:', tabId, 'theme:', options.theme, 'fontSize:', options.fontSize);

    const terminal = new Terminal({
      fontSize: options.fontSize,
      fontFamily: options.fontFamily,
      theme: options.theme === 'dark' ? darkTheme : lightTheme,
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    log('Addons loaded (fit, web-links) for tab:', tabId);

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    log('Terminal opened in DOM for tab:', tabId);

    // Track last known dimensions to skip no-op fit() calls
    let lastCols = 0;
    let lastRows = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    // Fit only if dimensions actually changed — prevents scroll reset on no-op resizes
    const safeFit = () => {
      if (!fitAddonRef.current) return;
      // Check proposed dimensions BEFORE calling fit() to avoid resetting scroll for no reason
      const dims = fitAddonRef.current.proposeDimensions();
      if (!dims) return;
      if (dims.cols === lastCols && dims.rows === lastRows) return;
      fitAddonRef.current.fit();
      lastCols = dims.cols;
      lastRows = dims.rows;
      ipcRenderer.send(IPC.TAB_RESIZE, tabId, dims.cols, dims.rows);
      terminal.scrollToBottom();
    };

    // Debounced fit for ResizeObserver — avoids rapid-fire during drag resize
    const debouncedFit = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(safeFit, 50);
    };

    // Let modifier key combos (Cmd+T, Cmd+W, etc.) bubble up to window handlers
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && ['t', 'w', 'Tab', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        return false;
      }
      return true;
    });

    // Fit after a small delay to ensure container is sized
    setTimeout(async () => {
      try {
        fitAddon.fit();
        lastCols = terminal.cols;
        lastRows = terminal.rows;
        log('Initial fit for tab:', tabId, 'cols:', lastCols, 'rows:', lastRows);
        ipcRenderer.send(IPC.TAB_RESIZE, tabId, lastCols, lastRows);
        terminal.scrollToBottom();
      } catch (err: any) {
        logError('Initial fit failed for tab:', tabId, err.message);
      }

      // Replay saved scrollback for restored sessions
      try {
        const scrollback: string = await ipcRenderer.invoke(IPC.TAB_GET_SCROLLBACK, tabId);
        if (scrollback) {
          log('Replaying scrollback for tab:', tabId, 'length:', scrollback.length);
          terminal.write(scrollback, () => terminal.scrollToBottom());
        }
      } catch (err: any) {
        logError('Failed to load scrollback for tab:', tabId, err.message);
      }
    }, 100);

    // Handle user input -> send to main process
    terminal.onData((data: string) => {
      ipcRenderer.send(IPC.TAB_INPUT, tabId, data);
    });

    // Handle output from main process -> write to terminal
    const onOutput = (_event: any, outputTabId: string, data: string) => {
      if (outputTabId === tabId) {
        terminal.write(data, () => {
          terminal.scrollToBottom();
        });
      }
    };
    ipcRenderer.on(IPC.TAB_OUTPUT, onOutput);
    log('IPC listeners attached for tab:', tabId);

    // Handle resize
    const onResize = () => {
      try {
        safeFit();
      } catch (err: any) {
        logError('Resize fit failed for tab:', tabId, err.message);
      }
    };
    window.addEventListener('resize', onResize);

    // ResizeObserver for container size changes — debounced
    const resizeObserver = new ResizeObserver(() => {
      try {
        debouncedFit();
      } catch (err: any) {
        logError('ResizeObserver fit failed for tab:', tabId, err.message);
      }
    });
    resizeObserver.observe(containerRef.current);
    log('ResizeObserver attached for tab:', tabId);

    return () => {
      log('Cleaning up terminal for tab:', tabId);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      ipcRenderer.removeListener(IPC.TAB_OUTPUT, onOutput);
      resizeObserver.disconnect();
      terminal.dispose();
      log('Terminal disposed for tab:', tabId);
    };
  }, [tabId]);

  return { terminalRef };
}
