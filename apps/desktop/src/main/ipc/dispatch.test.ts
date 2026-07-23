import { fc, test } from '@fast-check/vitest';
import { ipcChannels, type AccountsDocument, type IpcChannel } from '@recompose/contracts';
import { describe, expect } from 'vitest';

import { dispatchIpc, type IpcHandlers } from './dispatch';

const settings = { schemaVersion: 1, theme: 'dark', enginePort: 9000 } as const;
const emptyAccounts: AccountsDocument = { schemaVersion: 1, accounts: [] };

function handlersWith(overrides: Partial<IpcHandlers>): IpcHandlers {
  const reject = (): Promise<never> => Promise.reject(new Error('not under test'));
  const base: IpcHandlers = {
    'gateways:list': reject,
    'gateways:save': reject,
    'settings:get': reject,
    'settings:save': reject,
    'accounts:list': reject,
    'accounts:connect': reject,
    'accounts:remove': reject,
  };

  return { ...base, ...overrides };
}

function alwaysSucceedingHandlers(): IpcHandlers {
  return {
    'gateways:list': () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': () => Promise.resolve({ ok: true, value: settings }),
    'settings:save': () => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': () => Promise.resolve({ ok: true, value: emptyAccounts }),
    'accounts:connect': () => Promise.resolve({ ok: true, value: emptyAccounts }),
    'accounts:remove': () => Promise.resolve({ ok: true, value: emptyAccounts }),
  };
}

const anyChannel = fc.constantFrom<IpcChannel>(
  'gateways:list',
  'gateways:save',
  'settings:get',
  'settings:save',
  'accounts:list',
  'accounts:connect',
  'accounts:remove',
);

describe('ipc dispatch', () => {
  test('a malformed payload becomes a validation-failed envelope, not a throw', async () => {
    const result = await dispatchIpc(handlersWith({}), 'settings:save', { theme: 7 });

    expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
  });

  test('a valid payload reaches the handler and its result passes through', async () => {
    const handlers = handlersWith({
      'settings:save': (request) => Promise.resolve({ ok: true, value: request }),
    });

    const result = await dispatchIpc(handlers, 'settings:save', settings);

    expect(result).toEqual({ ok: true, value: settings });
  });

  test('a handler result that violates the response contract is rejected loudly', async () => {
    const outOfRangePort = 70000;
    const handlers = handlersWith({
      'settings:get': () =>
        Promise.resolve({ ok: true, value: { ...settings, enginePort: outOfRangePort } }),
    });

    await expect(dispatchIpc(handlers, 'settings:get', undefined)).rejects.toThrow();
  });
});

describe('ipc dispatch contract: every channel, any payload', () => {
  test.prop([anyChannel, fc.anything()])(
    'dispatch never rejects and always resolves to an envelope its channel accepts',
    async (channel, junkPayload) => {
      const result = await dispatchIpc(alwaysSucceedingHandlers(), channel, junkPayload);

      expect(ipcChannels[channel].response.safeParse(result).success).toBe(true);
    },
  );
});
