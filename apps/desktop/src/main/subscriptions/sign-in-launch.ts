import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type SignInLaunch = (command: string) => Promise<void>;

const WINDOW_MARK = 'recompose sign-in';

const linuxTerminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'];

async function detached(binary: string, argv: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...argv], { detached: true, stdio: 'ignore' });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function signInScript(command: string): string {
  return [
    '#!/bin/zsh',
    `printf '\\033]0;${WINDOW_MARK}\\007'`,
    'clear',
    command,
    'rm -f "$0"',
    'if [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then',
    `  osascript -e 'tell application "Terminal" to close (every window whose name contains "${WINDOW_MARK}") saving no' > /dev/null 2>&1 &`,
    'fi',
    '',
  ].join('\n');
}

/**
 * LaunchServices decides which terminal opens a .command file, which is the one place macOS
 * lets a person choose their terminal, and `open` brings that terminal to the front.
 */
async function openTheMacTerminal(command: string): Promise<void> {
  const script = join(tmpdir(), `recompose-sign-in-${randomUUID()}.command`);

  await writeFile(script, signInScript(command), { mode: 0o700 });
  await chmod(script, 0o700);
  await detached('open', [script]);
}

async function openALinuxTerminal(command: string): Promise<void> {
  for (const terminal of linuxTerminals) {
    try {
      await detached(terminal, ['-e', 'sh', '-c', command]);

      return;
    } catch {
      continue;
    }
  }

  throw new Error(`no terminal emulator on this machine could run ${command}`);
}

export function terminalSignInLaunch(
  platform: NodeJS.Platform,
  launcherOverride: string | null,
): SignInLaunch {
  return async (command) => {
    if (launcherOverride !== null) {
      await detached(launcherOverride, [command]);

      return;
    }

    if (platform === 'darwin') {
      await openTheMacTerminal(command);

      return;
    }

    if (platform === 'win32') {
      await detached('cmd.exe', ['/c', 'start', '', 'powershell', '-Command', command]);

      return;
    }

    await openALinuxTerminal(command);
  };
}
