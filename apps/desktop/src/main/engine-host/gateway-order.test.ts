import { describe, expect, test } from 'vitest';

import { createGatewayOrder } from './gateway-order';

function heldWork(log: string[], name: string) {
  let release = (): void => undefined;
  const held = new Promise<void>((settle) => {
    release = settle;
  });

  return {
    release,
    work: async () => {
      log.push(`${name} began`);
      await held;
      log.push(`${name} ended`);

      return name;
    },
  };
}

describe('taking turns per gateway', () => {
  test('a second directive for one gateway waits for the first to finish', async () => {
    const log: string[] = [];
    const inOrder = createGatewayOrder();
    const first = heldWork(log, 'start');
    const second = heldWork(log, 'stop');

    const starting = inOrder('codex', first.work);
    const stopping = inOrder('codex', second.work);

    await Promise.resolve();
    expect(log).toEqual(['start began']);

    first.release();
    await starting;
    second.release();
    await stopping;

    expect(log).toEqual(['start began', 'start ended', 'stop began', 'stop ended']);
  });

  test('two gateways never wait on each other', async () => {
    const log: string[] = [];
    const inOrder = createGatewayOrder();
    const codex = heldWork(log, 'codex');
    const gemini = heldWork(log, 'gemini');

    void inOrder('codex', codex.work);
    void inOrder('gemini', gemini.work);

    await Promise.resolve();

    expect(log).toEqual(['codex began', 'gemini began']);
  });

  test('a directive that failed never blocks the gateway behind it', async () => {
    const inOrder = createGatewayOrder();

    const refused = inOrder('codex', async () => Promise.reject(new Error('the engine refused')));

    await expect(refused).rejects.toThrow('the engine refused');
    await expect(inOrder('codex', async () => Promise.resolve('served'))).resolves.toBe('served');
  });

  test('the answer belongs to the directive that asked for it', async () => {
    const inOrder = createGatewayOrder();

    const answers = await Promise.all([
      inOrder('codex', async () => Promise.resolve('first')),
      inOrder('codex', async () => Promise.resolve('second')),
    ]);

    expect(answers).toEqual(['first', 'second']);
  });
});
