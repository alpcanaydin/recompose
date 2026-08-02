import { describe, expect, test, vi } from 'vitest';

import { terminalSignInLaunch } from './sign-in-launch';

type SpawnCall = { binary: string; argv: string[]; env?: Record<string, string> };

type WrittenFile = { path: string; content: string };

const spawned = vi.hoisted(() => {
  const calls: SpawnCall[] = [];

  return { calls };
});

const written = vi.hoisted(() => {
  const files: WrittenFile[] = [];

  return { files };
});

vi.mock('node:child_process', () => ({
  spawn: (binary: string, argv: string[], options?: { env?: Record<string, string> }) => {
    spawned.calls.push({
      binary,
      argv,
      ...(options?.env === undefined ? {} : { env: options.env }),
    });

    return {
      unref: () => undefined,
      once: (event: string, listener: () => void) => {
        if (event === 'spawn') {
          setTimeout(listener, 0);
        }
      },
    };
  },
}));

vi.mock('node:fs/promises', () => ({
  writeFile: async (path: string, content: string) => {
    written.files.push({ path, content });

    return Promise.resolve();
  },
  chmod: async () => Promise.resolve(),
}));

describe('handing the sign-in to a terminal on macOS', () => {
  test('the command runs from a .command file, so the terminal a person chose opens it', async () => {
    spawned.calls.length = 0;
    written.files.length = 0;

    await terminalSignInLaunch('darwin', null)('claude /login');

    const script = written.files[0];

    expect(script?.path).toMatch(/\.command$/);
    expect(script?.content).toContain('claude /login');
    expect(spawned.calls).toEqual([{ binary: 'open', argv: [script?.path] }]);
  });

  test('the window closes itself once the tool finishes, found by its tty, not its title', async () => {
    spawned.calls.length = 0;
    written.files.length = 0;

    await terminalSignInLaunch('darwin', null)('claude /login');

    const content = written.files[0]?.content ?? '';

    expect(content).toContain('rm -f "$0"');
    expect(content).toContain('SIGNIN_TTY="$(tty)"');
    expect(content).toContain(
      'if (tty of tabs of w) contains \\"$SIGNIN_TTY\\" then close w saving no',
    );
  });

  test('an override launcher takes the command whole, so end-to-end runs open no terminal', async () => {
    spawned.calls.length = 0;
    written.files.length = 0;

    await terminalSignInLaunch('darwin', '/tmp/fake-launcher')('claude /login');

    expect(written.files).toEqual([]);
    expect(spawned.calls).toEqual([{ binary: '/tmp/fake-launcher', argv: ['claude /login'] }]);
  });
});

describe('handing the sign-in to an override launcher on Windows', () => {
  const composite = '$env:CLAUDE_CONFIG_DIR="C:\\a b\\pending"; claude login';

  test('a .cmd override runs through cmd.exe, because Node will not spawn a batch file itself', async () => {
    spawned.calls.length = 0;

    await terminalSignInLaunch('win32', 'C:\\fakes\\sign-in-launcher.cmd')(composite);

    const call = spawned.calls[0];

    expect(call?.binary).toBe('cmd.exe');
    expect(call?.argv).toEqual(['/c', 'C:\\fakes\\sign-in-launcher.cmd']);
  });

  test('the command travels in the environment, so cmd.exe never has to quote it', async () => {
    spawned.calls.length = 0;

    await terminalSignInLaunch('win32', 'C:\\fakes\\sign-in-launcher.cmd')(composite);

    expect(spawned.calls[0]?.env?.['RECOMPOSE_SIGN_IN_COMMAND']).toBe(composite);
    expect(spawned.calls[0]?.argv).not.toContain(composite);
  });

  test('an .exe override runs directly, still handed the command through the environment', async () => {
    spawned.calls.length = 0;

    await terminalSignInLaunch('win32', 'C:\\fakes\\launcher.exe')(composite);

    const call = spawned.calls[0];

    expect(call?.binary).toBe('C:\\fakes\\launcher.exe');
    expect(call?.argv).toEqual([]);
    expect(call?.env?.['RECOMPOSE_SIGN_IN_COMMAND']).toBe(composite);
  });
});
