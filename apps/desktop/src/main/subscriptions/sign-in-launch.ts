import { spawn } from 'node:child_process';

export type SignInLaunch = (command: string) => Promise<void>;

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

function appleScriptFor(command: string): string {
  const quoted = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return [
    'tell application "Terminal"',
    `set signInTab to do script "${quoted}"`,
    'repeat while busy of signInTab',
    'delay 0.5',
    'end repeat',
    'close (first window whose tabs contains signInTab) saving no',
    'end tell',
  ].join('\n');
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
      await detached('osascript', ['-e', appleScriptFor(command)]);

      return;
    }

    if (platform === 'win32') {
      await detached('cmd.exe', ['/c', 'start', '', 'powershell', '-Command', command]);

      return;
    }

    await openALinuxTerminal(command);
  };
}
