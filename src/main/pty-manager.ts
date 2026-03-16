import * as pty from 'node-pty';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from './config-store';

const log = (msg: string, ...args: any[]) => console.log(`[ShellDock:pty] ${msg}`, ...args);
const logError = (msg: string, ...args: any[]) => console.error(`[ShellDock:pty] ERROR: ${msg}`, ...args);

interface ManagedSession {
  id: string;
  ptyProcess: pty.IPty;
  alive: boolean;
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
  cwd?: string,
): ManagedSession {
  const shell = detectShell();
  const startDir = cwd || process.env.HOME || process.cwd();
  log('Creating new session:', id, 'shell:', shell, 'cwd:', startDir);

  const env = { ...process.env, TERM: 'xterm-256color' };
  // Remove variables that interfere with nested tool sessions
  delete env.CLAUDECODE;

  const ptyProcess = pty.spawn(shell, ['--login'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: startDir,
    env: env as { [key: string]: string },
  });

  log('PTY spawned, pid:', ptyProcess.pid);

  // Catch EIO errors on the underlying socket to prevent uncaught exceptions
  const socket = (ptyProcess as any)._socket || (ptyProcess as any).socket;
  if (socket) {
    socket.on('error', (err: Error) => {
      log('PTY socket error for session:', id, err.message);
    });
  }

  ptyProcess.onData((data: string) => {
    onData(id, data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    log('PTY exited for session:', id, 'exitCode:', exitCode, 'signal:', signal);
    const session = sessions.get(id);
    if (session) session.alive = false;
    sessions.delete(id);
    if (!shuttingDown) {
      onExit(id);
    }
  });

  const session: ManagedSession = { id, ptyProcess, alive: true };
  sessions.set(id, session);
  log('Session registered. Total active sessions:', sessions.size);
  return session;
}

export function writeToSession(tabId: string, data: string): void {
  const session = sessions.get(tabId);
  if (session && session.alive) {
    try {
      session.ptyProcess.write(data);
    } catch (err: any) {
      log('Write failed for session:', tabId, err.message);
    }
  }
}

export function resizeSession(tabId: string, cols: number, rows: number): void {
  const session = sessions.get(tabId);
  if (session && session.alive) {
    try {
      log('Resizing session:', tabId, 'to', cols, 'x', rows);
      session.ptyProcess.resize(cols, rows);
    } catch (err: any) {
      log('Resize failed for session:', tabId, err.message);
    }
  }
}

export function killSession(tabId: string): void {
  const session = sessions.get(tabId);
  if (session) {
    log('Killing session:', tabId, 'pid:', session.ptyProcess.pid);
    session.alive = false;
    try { session.ptyProcess.kill(); } catch (_) {}
    sessions.delete(tabId);
    log('Session removed. Total active sessions:', sessions.size);
  }
}

export function killAllSessions(): void {
  log('Killing all PTY processes. Count:', sessions.size);
  shuttingDown = true;
  for (const [id, session] of sessions) {
    log('Killing PTY:', id, 'pid:', session.ptyProcess.pid);
    session.alive = false;
    try { session.ptyProcess.kill(); } catch (_) {}
  }
  sessions.clear();
  log('All PTY processes killed');
}

export function getSession(tabId: string): ManagedSession | undefined {
  return sessions.get(tabId);
}

function getProcessCwd(pid: number): string | null {
  try {
    if (process.platform === 'darwin') {
      const output = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`, { encoding: 'utf8' });
      const match = output.match(/^n(.+)$/m);
      return match ? match[1] : null;
    } else if (process.platform === 'linux') {
      return execSync(`readlink /proc/${pid}/cwd 2>/dev/null`, { encoding: 'utf8' }).trim() || null;
    }
  } catch (err: any) {
    logError('Failed to get cwd for pid:', pid, err.message);
  }
  return null;
}

export function getAllSessionCwds(): Record<string, string> {
  const cwds: Record<string, string> = {};
  for (const [id, session] of sessions) {
    const cwd = getProcessCwd(session.ptyProcess.pid);
    if (cwd) {
      cwds[id] = cwd;
      log('Got cwd for session:', id, '->', cwd);
    }
  }
  return cwds;
}
