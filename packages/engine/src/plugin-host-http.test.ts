import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginHostHTTPRequest, PluginHostHTTPTransport } from './plugin-host-http';
import type { PluginHostBridge } from './plugin-native-loader';

import { decodePluginEnvelope, pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';
import { subprocessHostHTTP } from './plugin-host-http';
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
    });
    expect(providerObservability().snapshot()[0]).not.toHaveProperty('url');
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

describe('PluginHost HTTP callback refusals', () => {
  it('should refuse a call whose URL is missing or not a string', async () => {
    const fixture = await hostHTTPFixture();
    const answer = decodePluginEnvelope(
      fixture.bridge.call(pluginMethods.hostHTTPDo, encoded({ Method: 'GET' })),
    );

    expect(answer).toMatchObject({
      ok: false,
      error: { code: 'host_call_failed', message: 'host HTTP URL is invalid' },
    });
  });

  it('should refuse a call whose payload is not an object', async () => {
    const fixture = await hostHTTPFixture();
    const answer = decodePluginEnvelope(
      fixture.bridge.call(pluginMethods.hostHTTPDo, new TextEncoder().encode('[]')),
    );

    expect(answer).toMatchObject({
      ok: false,
      error: { message: 'host HTTP request is not an object' },
    });
  });

  it('should read a call that names no method as a GET', async () => {
    const fixture = await hostHTTPFixture();

    fixture.bridge.call(
      pluginMethods.hostHTTPDo,
      encoded({ URL: 'https://example.test/v1/data', Method: '  ' }),
    );

    expect(fixture.captured.request).toMatchObject({ method: 'GET' });
  });

  it('should report a plain failure raised by the transport', async () => {
    const bridge = await bridgeWithTransport(() => {
      const failure: unknown = 'transport refused';

      throw failure;
    });
    const answer = decodePluginEnvelope(
      bridge.call(pluginMethods.hostHTTPDo, encoded({ URL: 'https://example.test/v1/data' })),
    );

    expect(answer).toMatchObject({
      ok: false,
      error: { code: 'host_call_failed', message: 'host HTTP request failed' },
    });
  });
});

describe('the subprocess host HTTP transport', () => {
  it('should answer with the status, headers and body the origin served', async () => {
    const server = await localServer();

    try {
      const response = subprocessHostHTTP({
        method: 'GET',
        url: `${server.origin}/data`,
        headers: { 'x-test': ['one'] },
        body: new Uint8Array(),
      });

      expect(response.statusCode).toBe(201);
      expect(new TextDecoder().decode(response.body)).toBe('served');
      expect(response.headers['x-echo']).toEqual(['yes']);
    } finally {
      await server.close();
    }
  });

  it('should raise the child failure when the origin cannot be reached', () => {
    const unreachable = {
      method: 'GET',
      url: 'http://127.0.0.1:1/unreachable',
      headers: {},
      body: new Uint8Array(),
    };

    expect(() => subprocessHostHTTP(unreachable)).toThrow();
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

async function bridgeWithTransport(transport: PluginHostHTTPTransport): Promise<PluginHostBridge> {
  let bridge: PluginHostBridge | undefined;
  const host = new PluginHost((_path, incoming) => {
    bridge = incoming;

    return registrationClient();
  }, transport);

  await host.load('http-plugin', '/http-plugin');

  return requiredBridge(bridge);
}

const originScript = String.raw`
const { createServer } = require('node:http');
const server = createServer((_request, response) => {
  response.writeHead(201, { 'x-echo': 'yes' });
  response.end('served');
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(String(server.address().port) + '\n');
});
`;

async function localServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const child = spawn(process.execPath, ['-e', originScript], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const port = await new Promise<string>((resolve) => {
    child.stdout.on('data', (chunk: Buffer) => {
      resolve(chunk.toString('utf8').trim());
    });
  });

  return {
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      child.kill();

      return Promise.resolve();
    },
  };
}

function requiredBridge(bridge: PluginHostBridge | undefined): PluginHostBridge {
  if (bridge === undefined) throw new Error('plugin bridge was not installed');

  return bridge;
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
