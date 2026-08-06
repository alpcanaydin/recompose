import { describe, expect, test } from 'vitest';

import { GATEWAY_CONFIG_VERSION } from './gateway-config';
import { ipcChannels } from './ipc';

const codex = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'codex',
  displayName: 'Codex',
  port: 8397,
  virtualModels: [
    { id: 'fast', displayName: 'Fast', target: { accountId: 'acc-key', providerModel: 'gpt-5' } },
  ],
  layout: { nodes: {} },
};

describe('the channel that reads an account model list', () => {
  test('a look names the account and nothing else', () => {
    const asked = { id: 'acc-key' };

    expect(ipcChannels['accounts:list-models'].request.parse(asked)).toEqual(asked);
  });

  test('a look naming no account is refused', () => {
    expect(() => ipcChannels['accounts:list-models'].request.parse({ id: '  ' })).toThrow();
  });

  test('a look carrying a credential is refused, because the renderer holds none', () => {
    expect(() =>
      ipcChannels['accounts:list-models'].request.parse({ id: 'acc-key', credential: 'sk-live' }),
    ).toThrow();
  });

  test('the ids an account serves travel back as a listed answer', () => {
    const answered = { ok: true, value: { standing: 'listed', modelIds: ['gpt-5'] } };

    expect(ipcChannels['accounts:list-models'].response.parse(answered)).toEqual(answered);
  });

  test('an account nothing could be read from travels back as the unlisted answer', () => {
    const answered = { ok: true, value: { standing: 'unlisted' } };

    expect(ipcChannels['accounts:list-models'].response.parse(answered)).toEqual(answered);
  });
});

describe('the channel that rewrites a stored gateway', () => {
  test('an update carries the whole document the gateway becomes', () => {
    expect(ipcChannels['gateways:update'].request.parse(codex)).toEqual(codex);
  });

  test('an update carrying no slug is refused, because it names what it rewrites', () => {
    const { slug, ...withoutSlug } = codex;

    expect(slug).toBe('codex');
    expect(() => ipcChannels['gateways:update'].request.parse(withoutSlug)).toThrow();
  });

  test('a landed update answers with every stored gateway, the way a save does', () => {
    const answered = { ok: true, value: [codex] };

    expect(ipcChannels['gateways:update'].response.parse(answered)).toEqual(answered);
  });

  test('a refused update answers with the failure envelope', () => {
    const refused = {
      ok: false,
      error: { code: 'storage-failed', message: 'recompose stores no gateway under "ghost"' },
    };

    expect(ipcChannels['gateways:update'].response.parse(refused)).toEqual(refused);
  });
});
