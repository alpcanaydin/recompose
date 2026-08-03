import { describe, expect, test } from 'vitest';

import { GATEWAY_CONFIG_VERSION } from './gateway-config';
import { ipcChannels, ipcErrorSchema, systemStateSchema, type IpcChannel } from './ipc';

const channelNames: IpcChannel[] = [
  'gateways:list',
  'gateways:save',
  'settings:get',
  'settings:save',
  'accounts:list',
  'accounts:connect',
  'accounts:remove',
  'accounts:check-key',
  'system:get',
  'system:open-config-folder',
  'system:window-band',
  'gateways:offer-port',
  'gateways:move-port',
  'engine:start',
  'engine:stop',
  'engine:states',
  'subscriptions:list',
  'subscriptions:tools',
  'subscriptions:sign-in',
  'subscriptions:restore',
  'subscriptions:activate',
];

describe('ipc channel registry', () => {
  test('exactly the twenty-one specified channels exist', () => {
    expect(Object.keys(ipcChannels).sort()).toEqual([...channelNames].sort());
  });

  test('no channel exists that could read a secret back', () => {
    for (const name of Object.keys(ipcChannels)) {
      expect(name).not.toMatch(/secret|credential|vault/i);
    }
  });

  test('no channel serves a gateway token, because that surface left with the token', () => {
    for (const name of Object.keys(ipcChannels)) {
      expect(name).not.toMatch(/token/i);
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

const connectedView = {
  id: 'acc-claude-max',
  provider: 'anthropic',
  label: 'Claude Max',
  signedInAs: 'someone@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

describe('what the subscription channels ask for', () => {
  test('signing in names the provider it delegates to, and carries no secret', () => {
    const signIn = ipcChannels['subscriptions:sign-in'].request;

    expect(signIn.safeParse({ provider: 'anthropic' }).success).toBe(true);
    expect(signIn.safeParse({ provider: 'openrouter' }).success).toBe(false);
    expect(signIn.safeParse({ provider: 'anthropic', secret: 'sk' }).success).toBe(false);
  });

  test('restoring and activating name an existing account rather than a provider', () => {
    for (const channel of ['subscriptions:restore', 'subscriptions:activate'] as const) {
      expect(() => ipcChannels[channel].request.parse({ id: 'acc-claude-max' })).not.toThrow();
      expect(() => ipcChannels[channel].request.parse({ id: '   ' })).toThrow();
      expect(() => ipcChannels[channel].request.parse({ provider: 'anthropic' })).toThrow();
    }
  });

  test('reading the subscriptions and the tools asks for nothing at all', () => {
    for (const channel of ['subscriptions:list', 'subscriptions:tools'] as const) {
      expect(ipcChannels[channel].request.safeParse(undefined).success).toBe(true);
      expect(ipcChannels[channel].request.safeParse({ provider: 'anthropic' }).success).toBe(false);
    }
  });
});

describe('what the subscription channels answer', () => {
  test('listing answers the views a row renders from, never a stored credential', () => {
    expect(
      ipcChannels['subscriptions:list'].response.parse({ ok: true, value: [connectedView] }),
    ).toEqual({ ok: true, value: [connectedView] });
    expect(() =>
      ipcChannels['subscriptions:list'].response.parse({
        ok: true,
        value: [{ ...connectedView, credentialRef: 'cred-7f3a' }],
      }),
    ).toThrow();
  });

  test('the tool report says whether a tool is there and what a person would run', () => {
    const report = {
      provider: 'openai',
      toolName: 'Codex',
      present: false,
      signInCommand: 'codex login',
      shellSetupLine: 'export CODEX_HOME="/homes/openai/active"',
    };

    expect(
      ipcChannels['subscriptions:tools'].response.parse({ ok: true, value: [report] }),
    ).toEqual({ ok: true, value: [report] });
  });

  test('every act on a subscription answers the refreshed views a screen redraws from', () => {
    for (const channel of [
      'subscriptions:list',
      'subscriptions:sign-in',
      'subscriptions:restore',
      'subscriptions:activate',
    ] as const) {
      expect(ipcChannels[channel].response.parse({ ok: true, value: [connectedView] })).toEqual({
        ok: true,
        value: [connectedView],
      });
    }
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

describe('the channels that answer with nothing', () => {
  test('opening the config folder carries no value back', () => {
    expect(
      ipcChannels['system:open-config-folder'].response.parse({ ok: true, value: undefined }),
    ).toEqual({ ok: true, value: undefined });
  });
});

describe('ipc error codes', () => {
  const everyCode = [
    'vault-unavailable',
    'vault-newer-schema',
    'settings-newer-schema',
    'accounts-newer-schema',
    'validation-failed',
    'storage-failed',
    'folder-open-failed',
    'name-conflict',
    'port-conflict',
    'tool-missing',
    'sign-in-timed-out',
    'keychain-denied',
  ];

  test('error codes are the closed set', () => {
    for (const code of everyCode) {
      expect(() => ipcErrorSchema.parse({ code, message: 'x' })).not.toThrow();
    }

    expect(() => ipcErrorSchema.parse({ code: 'other', message: 'x' })).toThrow();
  });

  test('the set holds exactly twelve codes, so a thirteenth arrives through a failing test', () => {
    expect(ipcErrorSchema.shape.code.options).toEqual(everyCode);
  });

  test('a missing tool names the tool and the remedy in its own sentence', () => {
    const missing = { code: 'tool-missing', message: 'Claude Code is not installed.' };

    expect(ipcErrorSchema.parse(missing)).toEqual(missing);
    expect(() => ipcErrorSchema.parse({ code: 'tool-missing', message: '' })).toThrow();
  });

  test('a conflict refusal carries the sentence the field prints', () => {
    const conflict = { code: 'port-conflict', message: 'work already holds this port.' };

    expect(ipcErrorSchema.parse(conflict)).toEqual(conflict);
    expect(() => ipcErrorSchema.parse({ code: 'port-conflict', message: '' })).toThrow();
  });
});
