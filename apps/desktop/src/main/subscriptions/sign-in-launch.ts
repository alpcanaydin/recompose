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

  return `tell application "Terminal" to do script "${quoted}"`;
}

async function openALinuxTerminal(command: string): Promise<void> {
  for (const terminal of linuxTerminals) {
    try {
      await detached(terminal, ['-e', 'sh', '-c', `${command}; exec sh`]);

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
      await detached('cmd.exe', ['/c', 'start', '', 'powershell', '-NoExit', '-Command', command]);

      return;
    }

    await openALinuxTerminal(command);
  };
}
