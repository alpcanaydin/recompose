import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';

const hygieneChildPath = fileURLToPath(new URL('testing/hygiene-child.mts', import.meta.url));

const markerSecret = 'sk-marker-fake-window-sentinel';

function windowsOf(value: string, size: number): string[] {
  return Array.from({ length: Math.max(value.length - size + 1, 0) }, (_, start) =>
    value.slice(start, start + size),
  );
}

describe('the pipes of a real engine child, fed a malformed probe carrying a secret', () => {
  test(
    'the refusal reaches the log while no window of the secret reaches either pipe',
    { timeout: 20_000 },
    async () => {
      const child = fork(hygieneChildPath, [], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        execArgv: [],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout.push(chunk);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr.push(chunk);
      });

      const exitedEarly = once(child, 'exit').then(([code]) => {
        throw new Error(
          `the hygiene child exited before it was asked anything: code ${String(code)}, stderr: ${Buffer.concat(stderr).toString()}`,
        );
      });

      exitedEarly.catch(() => undefined);

      try {
        await Promise.race([once(child, 'message'), exitedEarly]);
        child.send({
          kind: 'probe',
          id: 'd1',
          provider: 'anthropic',
          key: markerSecret,
          [markerSecret]: true,
        });

        await vi.waitFor(
          () => {
            expect(Buffer.concat(stderr).toString()).toContain('could not read');
          },
          { timeout: 15_000, interval: 50 },
        );

        const errSpoke = Buffer.concat(stderr).toString();
        const outSpoke = Buffer.concat(stdout).toString();

        for (const window of windowsOf(markerSecret, 8)) {
          expect(errSpoke).not.toContain(window);
          expect(outSpoke).not.toContain(window);
        }
      } finally {
        child.kill();
      }
    },
  );
});
