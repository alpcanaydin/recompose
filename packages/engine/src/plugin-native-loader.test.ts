import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { decodePluginEnvelope, pluginMethods } from './plugin-abi';
import { pluginLibraryExtension } from './plugin-archive';
import { loadNativePlugin } from './plugin-native-loader';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe.skipIf(process.platform === 'win32')('native plugin ABI loader', () => {
  it('should call and free a plugin-owned response buffer', async () => {
    const library = await compiledPlugin();
    const client = loadNativePlugin(library, {
      call: (method, request) =>
        encoded({ ok: true, result: { method, request: new TextDecoder().decode(request) } }),
    });

    const registered = decodePluginEnvelope(
      await client.call(pluginMethods.register, encoded({ schema_version: 2 })),
    );

    expect(registered).toMatchObject({ ok: true, result: { schema_version: 2 } });

    client.shutdown();
    await expect(client.call('after.shutdown', new Uint8Array())).rejects.toThrow('closed');
  });

  it('should call and free a host-owned response buffer', async () => {
    const client = loadNativePlugin(await compiledPlugin(), {
      call: (method, request) =>
        encoded({ ok: true, result: { method, request: new TextDecoder().decode(request) } }),
    });

    const roundtrip = decodePluginEnvelope(
      await client.call('host.roundtrip', encoded({ hello: 'world' })),
    );

    expect(roundtrip).toMatchObject({
      ok: true,
      result: { method: 'host.echo', request: '{"hello":"world"}' },
    });

    client.shutdown();
  });

  it('should reject an already-aborted native call before entering C', async () => {
    const client = loadNativePlugin(await compiledPlugin(), { call: () => encoded({ ok: true }) });
    const controller = new AbortController();

    controller.abort();

    await expect(client.call('never.called', new Uint8Array(), controller.signal)).rejects.toThrow(
      'aborted',
    );
    client.shutdown();
  });
});

// Helpers

async function compiledPlugin(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-native-plugin-'));
  const source = join(directory, 'plugin.c');
  const library = join(directory, `sample${pluginLibraryExtension(process.platform)}`);
  const flags = process.platform === 'darwin' ? ['-dynamiclib'] : ['-shared', '-fPIC'];

  temporaryDirectories.push(directory);
  await writeFile(source, pluginSource, 'utf8');
  await executeCompiler([...flags, '-o', library, source]);

  return library;
}

async function executeCompiler(arguments_: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile('cc', [...arguments_], (error) => {
      if (error === null) resolve();
      else reject(error instanceof Error ? error : new Error('native compiler failed'));
    });
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

const pluginSource = String.raw`
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#if defined(_WIN32)
#define EXPORT __declspec(dllexport)
#else
#define EXPORT __attribute__((visibility("default")))
#endif
typedef struct { void *ptr; size_t len; } cliproxy_buffer;
typedef int (*host_call_fn)(void *, const char *, const uint8_t *, size_t, cliproxy_buffer *);
typedef void (*host_free_fn)(void *, size_t);
typedef struct { uint32_t abi_version; void *host_ctx; host_call_fn call; host_free_fn free_buffer; } host_api;
typedef int (*plugin_call_fn)(const char *, const uint8_t *, size_t, cliproxy_buffer *);
typedef void (*plugin_free_fn)(void *, size_t);
typedef void (*plugin_shutdown_fn)(void);
typedef struct { uint32_t abi_version; plugin_call_fn call; plugin_free_fn free_buffer; plugin_shutdown_fn shutdown; } plugin_api;
static const host_api *host;
static int output(const void *data, size_t len, cliproxy_buffer *response) {
  response->ptr = malloc(len);
  if (!response->ptr) return 1;
  memcpy(response->ptr, data, len);
  response->len = len;
  return 0;
}
static int call_plugin(const char *method, const uint8_t *request, size_t len, cliproxy_buffer *response) {
  static const char registration[] = "{\"ok\":true,\"result\":{\"schema_version\":2,\"metadata\":{},\"capabilities\":{}}}";
  if (!strcmp(method, "plugin.register")) return output(registration, sizeof(registration) - 1, response);
  if (!strcmp(method, "host.roundtrip")) {
    cliproxy_buffer host_response = {0};
    int rc = host->call(host->host_ctx, "host.echo", request, len, &host_response);
    if (rc != 0) return rc;
    rc = output(host_response.ptr, host_response.len, response);
    host->free_buffer(host_response.ptr, host_response.len);
    return rc;
  }
  static const char failure[] = "{\"ok\":false,\"error\":{\"code\":\"unknown\",\"message\":\"unknown\"}}";
  output(failure, sizeof(failure) - 1, response);
  return 1;
}
static void free_buffer(void *ptr, size_t len) { (void)len; free(ptr); }
static void shutdown_plugin(void) {}
EXPORT int cliproxy_plugin_init(const host_api *incoming, plugin_api *plugin) {
  host = incoming;
  plugin->abi_version = 1;
  plugin->call = call_plugin;
  plugin->free_buffer = free_buffer;
  plugin->shutdown = shutdown_plugin;
  return 0;
}
`;
