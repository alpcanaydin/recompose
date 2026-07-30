import { describe, expect, test } from 'vitest';

import { GATEWAY_CONFIG_VERSION } from './gateway-config';
import {
  gatewayTokenStatusSchema,
  ipcChannels,
  ipcErrorSchema,
  systemStateSchema,
  type IpcChannel,
} from './ipc';

const channelNames: IpcChannel[] = [
  'gateways:list',
  'gateways:save',
  'settings:get',
  'settings:save',
  'accounts:list',
  'accounts:connect',
  'accounts:remove',
  'system:get',
  'system:open-config-folder',
  'gateway-token:status',
  'gateway-token:mint',
  'gateway-token:copy',
  'gateways:offer-port',
  'gateways:move-port',
  'engine:start',
  'engine:stop',
  'engine:states',
];

describe('ipc channel registry', () => {
  test('exactly the seventeen specified channels exist', () => {
    expect(Object.keys(ipcChannels).sort()).toEqual([...channelNames].sort());
  });

  test('no channel exists that could read a secret back', () => {
    for (const name of Object.keys(ipcChannels)) {
      expect(name).not.toMatch(/secret|credential|vault/i);
    }
  });

  test('every channel accepts the failure envelope', () => {
    for (const name of channelNames) {
      const errParse = ipcChannels[name].response.safeParse({
        ok: false,
        error: { code: 'storage-failed', message: 'disk on fire' },
      });

      expect(errParse.success).toBe(true);
    }
  });
});

describe('gateways:list channel', () => {
  test('a successful response round-trips', () => {
    const config = {
      schemaVersion: GATEWAY_CONFIG_VERSION,
      slug: 'personal',
      displayName: 'Personal',
      port: 8397,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: {
            kind: 'target',
            id: 't1',
            accountId: 'a1',
            providerModel: 'claude-sonnet-5',
            weight: 100,
          },
        },
      ],
      layout: { nodes: {} },
    };
    const parsed = ipcChannels['gateways:list'].response.parse({ ok: true, value: [config] });

    expect(parsed).toEqual({ ok: true, value: [config] });
  });
});

describe('accounts:connect channel', () => {
  test('request requires a non-blank secret and rejects extras', () => {
    const valid = { provider: 'anthropic', kind: 'api-key', label: 'Work', secret: 'sk-abc' };

    expect(() => ipcChannels['accounts:connect'].request.parse(valid)).not.toThrow();
    expect(() =>
      ipcChannels['accounts:connect'].request.parse({ ...valid, secret: '   ' }),
    ).toThrow();
    expect(() =>
      ipcChannels['accounts:connect'].request.parse({ ...valid, credentialRef: 'sneak' }),
    ).toThrow();
  });

  test('responses cannot smuggle the secret back', () => {
    const registry = {
      schemaVersion: 1,
      accounts: [
        { id: 'a1', provider: 'anthropic', kind: 'api-key', label: 'Work', credentialRef: 'c1' },
      ],
    };
    const smuggled = {
      schemaVersion: 1,
      accounts: [{ ...registry.accounts[0], secret: 'sk-abc' }],
    };

    expect(() =>
      ipcChannels['accounts:connect'].response.parse({ ok: true, value: registry }),
    ).not.toThrow();
    expect(() =>
      ipcChannels['accounts:connect'].response.parse({ ok: true, value: smuggled }),
    ).toThrow();
  });
});

describe('the system state crossing the bridge', () => {
  const observedSystemState = {
    fileBrowser: 'finder',
    loginItem: 'available',
    loginItemEnabled: true,
    menuBarVisible: false,
    configFolder: '/Users/someone/Library/Application Support/recompose',
  };

  test('a full reading round-trips', () => {
    expect(
      ipcChannels['system:get'].response.parse({ ok: true, value: observedSystemState }),
    ).toEqual({ ok: true, value: observedSystemState });
  });

  test('the file browser and the login-item availability are closed sets', () => {
    expect(() =>
      systemStateSchema.parse({ ...observedSystemState, fileBrowser: 'nautilus' }),
    ).toThrow();
    expect(() => systemStateSchema.parse({ ...observedSystemState, loginItem: 'maybe' })).toThrow();
  });

  test('a blank config folder is rejected', () => {
    expect(() =>
      systemStateSchema.parse({ ...observedSystemState, configFolder: '   ' }),
    ).toThrow();
  });

  test('the platform never rides along', () => {
    expect(() => systemStateSchema.parse({ ...observedSystemState, platform: 'darwin' })).toThrow();
  });
});

describe('the gateway token status crossing the bridge', () => {
  const maskedToken = 'rc-local-********tail';

  test('a stored token arrives masked', () => {
    const status = { masked: maskedToken, storage: 'available' };

    expect(ipcChannels['gateway-token:status'].response.parse({ ok: true, value: status })).toEqual(
      {
        ok: true,
        value: status,
      },
    );
  });

  test('an empty vault arrives as no mask at all', () => {
    const status = { masked: null, storage: 'plaintext-fallback' };

    expect(gatewayTokenStatusSchema.parse(status)).toEqual(status);
  });

  test('a blank mask is rejected, because absence is spelled null', () => {
    expect(() => gatewayTokenStatusSchema.parse({ masked: '', storage: 'available' })).toThrow();
  });

  test('the plaintext cannot ride beside the mask', () => {
    expect(() =>
      gatewayTokenStatusSchema.parse({
        masked: maskedToken,
        storage: 'available',
        token: 'rc-local-the-whole-thing',
      }),
    ).toThrow();
  });

  test('the secret-storage state is a closed set', () => {
    expect(() => gatewayTokenStatusSchema.parse({ masked: null, storage: 'encrypted' })).toThrow();
  });
});

describe('the channels that answer with nothing', () => {
  test('opening the config folder and copying the token both carry no value back', () => {
    for (const name of ['system:open-config-folder', 'gateway-token:copy'] as const) {
      expect(ipcChannels[name].response.parse({ ok: true, value: undefined })).toEqual({
        ok: true,
        value: undefined,
      });
    }
  });
});

describe('ipc error codes', () => {
  const everyCode = [
    'vault-unavailable',
    'vault-newer-schema',
    'settings-newer-schema',
    'validation-failed',
    'storage-failed',
    'folder-open-failed',
    'token-missing',
    'slug-conflict',
    'port-conflict',
  ];

  test('error codes are the closed set', () => {
    for (const code of everyCode) {
      expect(() => ipcErrorSchema.parse({ code, message: 'x' })).not.toThrow();
    }

    expect(() => ipcErrorSchema.parse({ code: 'other', message: 'x' })).toThrow();
  });

  test('the set holds exactly nine codes, so a tenth arrives through a failing test', () => {
    expect(ipcErrorSchema.shape.code.options).toEqual(everyCode);
  });

  test('a conflict refusal carries the sentence the field prints', () => {
    const conflict = { code: 'port-conflict', message: 'work already holds this port.' };

    expect(ipcErrorSchema.parse(conflict)).toEqual(conflict);
    expect(() => ipcErrorSchema.parse({ code: 'port-conflict', message: '' })).toThrow();
  });
});
