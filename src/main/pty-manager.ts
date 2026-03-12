import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from './config-store';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:pty] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:pty] ERROR: ${msg}`, ...args);

interface ManagedSession {
  id: string;
  ptyProcess: pty.IPty;
}

const sessions = new Map<string, ManagedSession>();
let shuttingDown = false;

function detectShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

export function createSession(
  onData: (tabId: string, data: string) => void,
  onExit: (tabId: string) => void,
): ManagedSession {
  return createSessionWithId(uuidv4(), onData, onExit);
}

export function createSessionWithId(
  id: string,
  onData: (tabId: string, data: string) => void,
  onExit: (tabId: string) => void,
): ManagedSession {
  const shell = detectShell();
  log('Creating new session:', id, 'shell:', shell);

  const env = { ...process.env, TERM: 'xterm-256color' };
  // Remove variables that interfere with nested tool sessions
  delete env.CLAUDECODE;

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.env.HOME || process.cwd(),
    env: env as { [key: string]: string },
  });

  log('PTY spawned, pid:', ptyProcess.pid);

  ptyProcess.onData((data: string) => {
    onData(id, data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    log('PTY exited for session:', id, 'exitCode:', exitCode, 'signal:', signal);
    sessions.delete(id);
    if (!shuttingDown) {
      onExit(id);
    }
  });

  const session: ManagedSession = { id, ptyProcess };
  sessions.set(id, session);
  log('Session registered. Total active sessions:', sessions.size);
  return session;
}

export function writeToSession(tabId: string, data: string): void {
  const session = sessions.get(tabId);
  if (session) {
    session.ptyProcess.write(data);
  } else {
    logError('writeToSession: no session found for tabId:', tabId);
  }
}

export function resizeSession(tabId: string, cols: number, rows: number): void {
  const session = sessions.get(tabId);
  if (session) {
    log('Resizing session:', tabId, 'to', cols, 'x', rows);
    session.ptyProcess.resize(cols, rows);
  } else {
    logError('resizeSession: no session found for tabId:', tabId);
  }
}

export function killSession(tabId: string): void {
  const session = sessions.get(tabId);
  if (session) {
    log('Killing session:', tabId, 'pid:', session.ptyProcess.pid);
    session.ptyProcess.kill();
    sessions.delete(tabId);
    log('Session removed. Total active sessions:', sessions.size);
  } else {
    logError('killSession: no session found for tabId:', tabId);
  }
}

export function killAllSessions(): void {
  log('Killing all PTY processes. Count:', sessions.size);
  shuttingDown = true;
  for (const [id, session] of sessions) {
    log('Killing PTY:', id, 'pid:', session.ptyProcess.pid);
    session.ptyProcess.kill();
  }
  sessions.clear();
  log('All PTY processes killed');
}

export function getSession(tabId: string): ManagedSession | undefined {
  return sessions.get(tabId);
}
