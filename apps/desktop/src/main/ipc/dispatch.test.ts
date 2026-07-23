import { fc, test } from '@fast-check/vitest';
import { ipcChannels, type AccountsDocument, type IpcChannel } from '@recompose/contracts';
import { describe, expect } from 'vitest';

import type { AllowedOrigins, TrustedSender } from './sender-trust';

import { dispatchIpc, ipcChannelNames, type IpcHandlers } from './dispatch';

const settings = { schemaVersion: 1, theme: 'dark', enginePort: 9000 } as const;
const emptyAccounts: AccountsDocument = { schemaVersion: 1, accounts: [] };

const trustedSender: TrustedSender = {
  frameUrl: 'file:///Applications/recompose.app/renderer/index.html',
  isMainFrame: true,
};
const allowedOrigins: AllowedOrigins = { devServerOrigin: undefined };

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

const anyChannel = fc.constantFrom<IpcChannel>(...ipcChannelNames);
const voidRequestChannel = fc.constantFrom<IpcChannel>(
  'gateways:list',
  'settings:get',
  'accounts:list',
);
const nonUndefinedJunk = fc.anything().filter((value) => value !== undefined);

describe('ipc dispatch', () => {
  test('every contract channel is registered for dispatch', () => {
    expect([...ipcChannelNames].sort()).toEqual(Object.keys(ipcChannels).sort());
  });

  test('a malformed payload becomes a validation-failed envelope, not a throw', async () => {
    const result = await dispatchIpc(
      handlersWith({}),
      'settings:save',
      { theme: 7 },
      trustedSender,
      allowedOrigins,
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
  });

  test('a valid payload reaches the handler and its result passes through', async () => {
    const handlers = handlersWith({
      'settings:save': (request) => Promise.resolve({ ok: true, value: request }),
    });

    const result = await dispatchIpc(
      handlers,
      'settings:save',
      settings,
      trustedSender,
      allowedOrigins,
    );

    expect(result).toEqual({ ok: true, value: settings });
  });

  test('a handler result that violates the response contract is rejected loudly', async () => {
    const outOfRangePort = 70000;
    const handlers = handlersWith({
      'settings:get': () =>
        Promise.resolve({ ok: true, value: { ...settings, enginePort: outOfRangePort } }),
    });

    await expect(
      dispatchIpc(handlers, 'settings:get', undefined, trustedSender, allowedOrigins),
    ).rejects.toThrow();
  });
});

describe('ipc dispatch: sender trust rejects', () => {
  test('an untrusted sender is rejected before the handler ever runs', async () => {
    const calls: string[] = [];
    const handlers = handlersWith({
      'settings:save': (request) => {
        calls.push('settings:save');

        return Promise.resolve({ ok: true, value: request });
      },
    });
    const foreignSender: TrustedSender = {
      frameUrl: 'https://evil.example.com',
      isMainFrame: true,
    };

    await expect(
      dispatchIpc(handlers, 'settings:save', settings, foreignSender, allowedOrigins),
    ).rejects.toThrow();

    expect(calls).toEqual([]);
  });

  test('a disposed frame is rejected before schema parsing runs', async () => {
    const disposedSender: TrustedSender = { frameUrl: null, isMainFrame: false };

    await expect(
      dispatchIpc(handlersWith({}), 'settings:save', { theme: 7 }, disposedSender, allowedOrigins),
    ).rejects.toThrow();
  });

  test('a non-main frame at an otherwise trusted origin is rejected', async () => {
    const subFrameSender: TrustedSender = {
      frameUrl: 'file:///Applications/recompose.app/renderer/index.html',
      isMainFrame: false,
    };

    await expect(
      dispatchIpc(handlersWith({}), 'settings:get', undefined, subFrameSender, allowedOrigins),
    ).rejects.toThrow();
  });
});

describe('ipc dispatch: sender trust accepts', () => {
  test('the packaged app and the configured dev server both reach the handler', async () => {
    const handlers = handlersWith({
      'settings:get': () => Promise.resolve({ ok: true, value: settings }),
    });
    const devSender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: true };
    const devOrigins: AllowedOrigins = { devServerOrigin: 'http://localhost:5173' };

    const fileResult = await dispatchIpc(
      handlers,
      'settings:get',
      undefined,
      trustedSender,
      allowedOrigins,
    );
    const devResult = await dispatchIpc(handlers, 'settings:get', undefined, devSender, devOrigins);

    expect(fileResult).toEqual({ ok: true, value: settings });
    expect(devResult).toEqual({ ok: true, value: settings });
  });
});

describe('ipc dispatch contract: every channel, any payload', () => {
  test.prop([anyChannel, fc.anything()])(
    'dispatch never rejects and always resolves to an envelope its channel accepts',
    async (channel, junkPayload) => {
      const result = await dispatchIpc(
        alwaysSucceedingHandlers(),
        channel,
        junkPayload,
        trustedSender,
        allowedOrigins,
      );

      expect(ipcChannels[channel].response.safeParse(result).success).toBe(true);
    },
  );

  test.prop([voidRequestChannel, nonUndefinedJunk])(
    'non-undefined junk on a void-request channel always yields a typed validation-failed envelope',
    async (channel, junkPayload) => {
      const result = await dispatchIpc(
        alwaysSucceedingHandlers(),
        channel,
        junkPayload,
        trustedSender,
        allowedOrigins,
      );

      expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
    },
  );
});
