import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import {
  callPlugin,
  decodePluginEnvelope,
  lifecycleRequest,
  pluginMethods,
  PluginRPCError,
} from './plugin-abi';

describe('plugin ABI method names', () => {
  it('should keep stable lifecycle, executor, scheduler, and routing names', () => {
    expect(pluginMethods).toMatchObject({
      register: 'plugin.register',
      reconfigure: 'plugin.reconfigure',
      shutdown: 'plugin.shutdown',
      requestComplete: 'request.complete',
      executorExecute: 'executor.execute',
      executorStream: 'executor.execute_stream',
      schedulerPick: 'scheduler.pick',
      modelRoute: 'model.route',
    });
  });
});

describe('plugin RPC envelopes', () => {
  it('should decode a successful result', () => {
    expect(decodePluginEnvelope(encoded({ ok: true, result: { identifier: 'sample' } }))).toEqual({
      ok: true,
      result: { identifier: 'sample' },
    });
  });

  it('should surface structured plugin failures', async () => {
    const client = clientAnswering({
      ok: false,
      error: { code: 'quota', message: 'quota exhausted', retryable: true, http_status: 429 },
    });

    await expect(callPlugin(client, 'executor.execute', {}, String)).rejects.toMatchObject({
      name: 'PluginRPCError',
      code: 'quota',
      retryable: true,
      httpStatus: 429,
    } satisfies Partial<PluginRPCError>);
  });

  it('should reject malformed envelopes', () => {
    expect(() => decodePluginEnvelope(encoded({ result: {} }))).toThrow('valid RPC envelope');
  });

  it('should reject a payload that is not an object at all', () => {
    expect(() => decodePluginEnvelope(encoded(['ok']))).toThrow('valid RPC envelope');
  });

  it('should reject a failure envelope whose error is not an object', () => {
    expect(() => decodePluginEnvelope(encoded({ ok: false, error: 'quota exhausted' }))).toThrow(
      'plugin error envelope carries no error',
    );
  });
});

describe('plugin failures the plugin spelled incompletely', () => {
  it('should name an unspelled code, message, retry and status for the caller', async () => {
    const client = clientAnswering({ ok: false, error: {} });

    await expect(callPlugin(client, 'executor.execute', {}, String)).rejects.toMatchObject({
      code: 'plugin_error',
      message: 'plugin call failed',
      retryable: false,
      httpStatus: 0,
    } satisfies Partial<PluginRPCError>);
  });

  it('should ignore code, message and status the plugin spelled in the wrong shape', async () => {
    const client = clientAnswering({
      ok: false,
      error: { code: 7, message: { text: 'nope' }, retryable: 'yes', http_status: '429' },
    });

    await expect(callPlugin(client, 'executor.execute', {}, String)).rejects.toMatchObject({
      code: 'plugin_error',
      message: 'plugin call failed',
      retryable: false,
      httpStatus: 0,
    } satisfies Partial<PluginRPCError>);
  });

  it('should stand in a message when the plugin sent an empty one', async () => {
    const client = clientAnswering({
      ok: false,
      error: { code: 'quota', message: '', retryable: true, http_status: 429 },
    });

    await expect(callPlugin(client, 'executor.execute', {}, String)).rejects.toMatchObject({
      code: 'quota',
      message: 'plugin call failed',
      httpStatus: 429,
    } satisfies Partial<PluginRPCError>);
  });
});

describe('plugin lifecycle requests', () => {
  it('should carry schema version two and Go-compatible base64 bytes', () => {
    expect(lifecycleRequest(new TextEncoder().encode('mode: test'))).toEqual({
      config_yaml: 'bW9kZTogdGVzdA==',
      schema_version: 2,
    });
  });
});

// Helpers

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function clientAnswering(value: unknown): PluginClient {
  return {
    call: async () => Promise.resolve(encoded(value)),
    shutdown: () => undefined,
  };
}
