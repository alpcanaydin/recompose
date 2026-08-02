import { describe, expect, test, vi } from 'vitest';

import { terminalSignInLaunch } from './sign-in-launch';

type SpawnCall = { binary: string; argv: string[] };

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
  spawn: (binary: string, argv: string[]) => {
    spawned.calls.push({ binary, argv });

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

  test('the window closes itself once the tool finishes, instead of standing spent', async () => {
    spawned.calls.length = 0;
    written.files.length = 0;

    await terminalSignInLaunch('darwin', null)('claude /login');

    const content = written.files[0]?.content ?? '';

    expect(content).toContain('rm -f "$0"');
    expect(content).toContain('close (every window whose name contains "recompose sign-in")');
  });

  test('an override launcher takes the command whole, so end-to-end runs open no terminal', async () => {
    spawned.calls.length = 0;
    written.files.length = 0;

    await terminalSignInLaunch('darwin', '/tmp/fake-launcher')('claude /login');

    expect(written.files).toEqual([]);
    expect(spawned.calls).toEqual([{ binary: '/tmp/fake-launcher', argv: ['claude /login'] }]);
  });
});
