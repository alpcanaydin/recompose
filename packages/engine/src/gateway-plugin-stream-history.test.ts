import { describe, expect, it } from 'vitest';

import {
  askResponseGateway,
  pluginStreamAnswer,
  responseGateway,
} from './gateway-plugin-response.testkit';
import { responseHost, responsePlugin } from './plugin-response-interceptor.testkit';

describe('gateway stream interceptor history bounds', () => {
  it('should retain only the latest 64 delivered chunks', async () => {
    let retained: string[] = [];
    const plugin = responsePlugin({ stream: true }, (_method, request) => {
      if (request['ChunkIndex'] === 65) retained = decodedHistory(request['HistoryChunks']);

      return {};
    });
    const host = await responseHost([['history', 1, plugin]]);
    const chunks = Array.from({ length: 66 }, (_value, index) => String(index).padStart(2, '0'));
    const { app } = responseGateway(host, () => pluginStreamAnswer(chunks));

    const answer = await askResponseGateway(app);

    await answer.arrayBuffer();
    expect(retained).toHaveLength(64);
    expect(retained[0]).toBe('01');
    expect(retained.at(-1)).toBe('64');
  });

  it('should retain no more than one MiB of delivered chunks', async () => {
    let retainedSizes: number[] = [];
    const plugin = responsePlugin({ stream: true }, (_method, request) => {
      if (request['ChunkIndex'] === 2) retainedSizes = historySizes(request['HistoryChunks']);

      return {};
    });
    const host = await responseHost([['history', 1, plugin]]);
    const large = 'x'.repeat(600_000);
    const { app } = responseGateway(host, () => pluginStreamAnswer([large, large, large]));

    const answer = await askResponseGateway(app);

    await answer.arrayBuffer();
    expect(retainedSizes).toEqual([600_000]);
  });
});

describe('gateway stream interceptor header initialization', () => {
  it('should finish header initialization before returning the response', async () => {
    const initialized = deferred();
    const released = deferred();
    const plugin = responsePlugin({ stream: true }, async (_method, request) => {
      if (request['ChunkIndex'] !== -1) return {};

      initialized.resolve();
      await released.promise;

      return { Headers: { 'x-initialized': ['yes'] } };
    });
    const host = await responseHost([['headers', 1, plugin]]);
    const { app } = responseGateway(host, () => pluginStreamAnswer(['payload']));
    let answered = false;
    const pending = askResponseGateway(app).then((answer) => {
      answered = true;

      return answer;
    });

    await initialized.promise;
    await Promise.resolve();
    expect(answered).toBe(false);

    released.resolve();
    const answer = await pending;

    expect(answer.headers.get('x-initialized')).toBe('yes');
    await expect(answer.text()).resolves.toBe('payload');
  });
});

// Helpers

function decodedHistory(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === 'string' ? Buffer.from(item, 'base64').toString('utf8') : '',
      )
    : [];
}

function historySizes(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? Buffer.from(item, 'base64').byteLength : 0))
    : [];
}

function deferred() {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}
