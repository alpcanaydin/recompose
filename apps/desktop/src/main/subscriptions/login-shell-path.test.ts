import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loginShellPath } from './login-shell-path';

const environmentPath = '/usr/bin:/bin';

const spawnsALoginShell = process.platform !== 'win32';

async function aLoginShellRunning(body: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'recompose-login-shell-'));
  const shell = join(folder, 'fake-login-shell');

  await writeFile(shell, `#!/bin/sh\n${body}\n`, 'utf8');
  await chmod(shell, 0o755);

  return shell;
}

async function aLoginShellReporting(report: string): Promise<string> {
  return aLoginShellRunning(`cat <<'REPORT'\n${report}\nREPORT`);
}

async function pathProbed(shell: string | undefined, boundMs = 5000): Promise<string> {
  return loginShellPath({ shell, environmentPath, platform: 'linux', boundMs });
}

describe('reading the search path a login shell carries', () => {
  test.skipIf(!spawnsALoginShell)(
    'given a login shell that reports its environment, the probe answers the path it carries',
    async () => {
      const shell = await aLoginShellReporting('HOME=/home/ada\nPATH=/opt/tools/bin:/usr/bin');

      await expect(pathProbed(shell)).resolves.toBe('/opt/tools/bin:/usr/bin');
    },
  );

  test.skipIf(!spawnsALoginShell)(
    'given a shell that carries a different path without a login, the probe asks for the login one',
    async () => {
      const shell = await aLoginShellRunning(
        'if [ "$1" = "-lc" ] && [ "$2" = "env" ]; then echo "PATH=/from-the-login-shell"; else echo "PATH=/from-a-plain-shell"; fi',
      );

      await expect(pathProbed(shell)).resolves.toBe('/from-the-login-shell');
    },
  );
});

describe('falling back to the path this process already runs under', () => {
  test.skipIf(!spawnsALoginShell)(
    'given a login shell that names no path, the process environment path stands',
    async () => {
      const shell = await aLoginShellReporting('HOME=/home/ada\nMANPATH=/usr/share/man');

      await expect(pathProbed(shell)).resolves.toBe(environmentPath);
    },
  );

  test.skipIf(!spawnsALoginShell)(
    'given a login shell reporting a blank path, the process environment path stands',
    async () => {
      const shell = await aLoginShellReporting('PATH=');

      await expect(pathProbed(shell)).resolves.toBe(environmentPath);
    },
  );

  test.skipIf(!spawnsALoginShell)(
    'given a login shell that hangs past the bound, the process environment path stands',
    async () => {
      const shell = await aLoginShellRunning('sleep 30');

      await expect(pathProbed(shell, 100)).resolves.toBe(environmentPath);
    },
  );

  test.skipIf(!spawnsALoginShell)(
    'given a login shell whose profile breaks, the process environment path stands',
    async () => {
      const shell = await aLoginShellRunning('exit 1');

      await expect(pathProbed(shell)).resolves.toBe(environmentPath);
    },
  );

  test('given a machine naming no login shell, the process environment path stands', async () => {
    await expect(pathProbed(undefined)).resolves.toBe(environmentPath);
    await expect(pathProbed('')).resolves.toBe(environmentPath);
  });

  test('given Windows, no shell is asked even when one would answer', async () => {
    const shell = await aLoginShellReporting('PATH=/from-a-shell-that-should-never-run');

    const answered = await loginShellPath({
      shell,
      environmentPath: 'C:\\tools;C:\\Windows',
      platform: 'win32',
      boundMs: 5000,
    });

    expect(answered).toBe('C:\\tools;C:\\Windows');
  });
});
