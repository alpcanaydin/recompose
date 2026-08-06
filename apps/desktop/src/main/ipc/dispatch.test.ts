import { fc, test } from '@fast-check/vitest';
import {
  GATEWAY_CONFIG_VERSION,
  ipcChannels,
  type IpcChannel,
  type SettingsPatch,
} from '@recompose/contracts';
import { describe, expect } from 'vitest';

import type { AllowedOrigins, TrustedSender } from './sender-trust';

import { dispatchIpc, ipcChannelNames } from './dispatch';
import { alwaysSucceedingHandlers, darkSettings, handlersWith } from './ipc-handlers.testkit';

const settings = darkSettings;
const trustedSender: TrustedSender = {
  frameUrl: 'app://renderer/index.html',
  isMainFrame: true,
};
const allowedOrigins: AllowedOrigins = { devServerOrigin: undefined };

const anyChannel = fc.constantFrom<IpcChannel>(...ipcChannelNames);
const voidRequestChannel = fc.constantFrom<IpcChannel>(
  'gateways:list',
  'settings:get',
  'accounts:list',
  'system:get',
  'system:open-config-folder',
  'system:title-bar-double-click',
  'gateways:offer-port',
  'engine:states',
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
    const seen: SettingsPatch[] = [];
    const handlers = handlersWith({
      'settings:save': async (request) => {
        seen.push(request);

        return Promise.resolve({ ok: true, value: settings });
      },
    });

    const result = await dispatchIpc(
      handlers,
      'settings:save',
      { theme: 'dark' },
      trustedSender,
      allowedOrigins,
    );

    expect(seen).toEqual([{ theme: 'dark' }]);
    expect(result).toEqual({ ok: true, value: settings });
  });
});

describe('ipc dispatch: the settings patch', () => {
  test('a save carrying the schema version is rejected, because a patch never names it', async () => {
    const result = await dispatchIpc(
      handlersWith({}),
      'settings:save',
      settings,
      trustedSender,
      allowedOrigins,
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'validation-failed' } });
  });

  test('a handler result that violates the response contract is rejected loudly', async () => {
    const handlers = handlersWith({
      'gateways:list': async () =>
        Promise.resolve({
          ok: true,
          value: [
            {
              schemaVersion: GATEWAY_CONFIG_VERSION,
              slug: 'Not A Slug',
              displayName: 'Personal',
              port: 8397,
              virtualModels: [],
              layout: { nodes: {} },
            },
          ],
        }),
    });

    await expect(
      dispatchIpc(handlers, 'gateways:list', undefined, trustedSender, allowedOrigins),
    ).rejects.toThrow();
  });
});

describe('ipc dispatch: sender trust rejects', () => {
  test('an untrusted sender is rejected before the handler ever runs', async () => {
    const calls: string[] = [];
    const handlers = handlersWith({
      'settings:save': async () => {
        calls.push('settings:save');

        return Promise.resolve({ ok: true, value: settings });
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
    const calls: string[] = [];
    const handlers = handlersWith({
      'settings:get': async () => {
        calls.push('settings:get');

        return Promise.resolve({ ok: true, value: settings });
      },
    });
    const subFrameSender: TrustedSender = {
      frameUrl: 'app://renderer/index.html',
      isMainFrame: false,
    };

    await expect(
      dispatchIpc(handlers, 'settings:get', undefined, subFrameSender, allowedOrigins),
    ).rejects.toThrow();

    expect(calls).toEqual([]);
  });
});

describe('ipc dispatch: sender trust accepts', () => {
  test('the packaged app and the configured dev server both reach the handler', async () => {
    const handlers = handlersWith({
      'settings:get': async () => Promise.resolve({ ok: true, value: settings }),
    });
    const devSender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: true };
    const devOrigins: AllowedOrigins = { devServerOrigin: 'http://localhost:5173' };

    const packagedResult = await dispatchIpc(
      handlers,
      'settings:get',
      undefined,
      trustedSender,
      allowedOrigins,
    );
    const devResult = await dispatchIpc(handlers, 'settings:get', undefined, devSender, devOrigins);

    expect(packagedResult).toEqual({ ok: true, value: settings });
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
