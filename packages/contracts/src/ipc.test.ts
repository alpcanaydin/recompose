import { describe, expect, test } from 'vitest';

import { GATEWAY_CONFIG_VERSION } from './gateway-config';
import { ipcChannels, ipcErrorSchema, type IpcChannel } from './ipc';

const channelNames: IpcChannel[] = [
  'gateways:list',
  'gateways:save',
  'settings:get',
  'settings:save',
  'accounts:list',
  'accounts:connect',
  'accounts:remove',
];

describe('ipc channel registry', () => {
  test('exactly the seven specified channels exist', () => {
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

describe('ipc error codes', () => {
  test('error codes are the closed set', () => {
    for (const code of [
      'vault-unavailable',
      'vault-newer-schema',
      'validation-failed',
      'storage-failed',
    ]) {
      expect(() => ipcErrorSchema.parse({ code, message: 'x' })).not.toThrow();
    }

    expect(() => ipcErrorSchema.parse({ code: 'other', message: 'x' })).toThrow();
  });
});
