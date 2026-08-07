import { afterEach, describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginHostHTTPRequest } from './plugin-host-http';
import type { PluginHostBridge } from './plugin-native-loader';

import { decodePluginEnvelope, pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';
import { providerObservability } from './provider/provider-observability';

afterEach(() => {
  providerObservability().clear();
});

describe('PluginHost HTTP callback', () => {
  it('should execute through injected transport and record observability', async () => {
    const fixture = await hostHTTPFixture();
    const response = decodePluginEnvelope(
      fixture.bridge.call(
        pluginMethods.hostHTTPDo,
        encoded({
          Method: 'POST',
          URL: 'https://example.test/v1/data',
          Headers: { 'x-test': ['one'] },
          Body: Buffer.from('{"request":true}').toString('base64'),
        }),
      ),
    );

    expect(fixture.captured.request).toMatchObject({
      method: 'POST',
      url: 'https://example.test/v1/data',
      headers: { 'x-test': ['one'] },
    });
    expect(new TextDecoder().decode(fixture.captured.request?.body)).toBe('{"request":true}');
    expect(response).toMatchObject({
      ok: true,
      result: {
        StatusCode: 202,
        Headers: { 'x-response': ['ok'] },
        Body: 'eyJyZXNwb25zZSI6dHJ1ZX0=',
      },
    });
    expect(providerObservability().snapshot()[0]).toMatchObject({
      provider: 'plugin:http-plugin',
      status: 202,
      method: 'POST',
      url: 'https://example.test/v1/data',
    });
  });

  it('should return error envelopes for unsafe URLs and unknown methods', async () => {
    const fixture = await hostHTTPFixture();
    const unsafe = decodePluginEnvelope(
      fixture.bridge.call(
        pluginMethods.hostHTTPDo,
        encoded({ Method: 'GET', URL: 'file:///etc/passwd' }),
      ),
    );
    const unknown = decodePluginEnvelope(fixture.bridge.call('host.unknown', encoded({})));

    expect(unsafe).toMatchObject({ ok: false, error: { code: 'host_call_failed' } });
    expect(unknown).toMatchObject({ ok: false, error: { code: 'unknown_host_method' } });
  });
});

// Helpers

function registrationClient(): PluginClient {
  return {
    call: async () =>
      Promise.resolve(
        encoded({
          ok: true,
          result: { schema_version: 2, metadata: {}, capabilities: {} },
        }),
      ),
    shutdown: () => undefined,
  };
}

async function hostHTTPFixture(): Promise<{
  bridge: PluginHostBridge;
  captured: { request?: PluginHostHTTPRequest | undefined };
}> {
  let bridge: PluginHostBridge | undefined;
  const captured: { request?: PluginHostHTTPRequest | undefined } = {};
  const host = new PluginHost(
    (_path, incoming) => {
      bridge = incoming;

      return registrationClient();
    },
    (incoming) => {
      captured.request = incoming;

      return {
        statusCode: 202,
        headers: { 'x-response': ['ok'] },
        body: new TextEncoder().encode('{"response":true}'),
      };
    },
  );

  await host.load('http-plugin', '/http-plugin');

  return { bridge: requiredBridge(bridge), captured };
}

function requiredBridge(bridge: PluginHostBridge | undefined): PluginHostBridge {
  if (bridge === undefined) throw new Error('plugin bridge was not installed');

  return bridge;
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
