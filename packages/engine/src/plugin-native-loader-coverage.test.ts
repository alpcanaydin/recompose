import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { PluginHostBridge } from './plugin-native-loader';

import { pluginLibraryExtension } from './plugin-archive';
import { loadNativePlugin } from './plugin-native-loader';

const temporaryDirectories: string[] = [];
const unexplainedFailures = [
  { method: 'bad.status', code: 2 },
  { method: 'not.json', code: 3 },
  { method: 'null.body', code: 4 },
  { method: 'plain.number', code: 5 },
  { method: 'no.ok', code: 6 },
];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe.skipIf(process.platform === 'win32')('native plugin handshake', () => {
  it('should refuse a plugin whose initializer reports a failure', async () => {
    const library = await compiledPlugin(['-DINIT_RESULT=7']);

    expect(() => loadNativePlugin(library, echoBridge())).toThrow(
      'cliproxy_plugin_init returned 7',
    );
  });

  it('should refuse a plugin built against another ABI version', async () => {
    const library = await compiledPlugin(['-DPLUGIN_ABI=99']);

    expect(() => loadNativePlugin(library, echoBridge())).toThrow(
      'plugin ABI version 99 is not supported',
    );
  });

  it('should refuse a plugin that offers an incomplete function table', async () => {
    const library = await compiledPlugin(['-DPLUGIN_TABLE=0']);

    expect(() => loadNativePlugin(library, echoBridge())).toThrow(
      'plugin function table is incomplete',
    );
  });
});

describe.skipIf(process.platform === 'win32')('native plugin answers', () => {
  it('should read an empty answer when the plugin writes no buffer', async () => {
    const client = loadNativePlugin(await compiledPlugin(), echoBridge());

    await expect(client.call('empty.answer', new Uint8Array())).resolves.toEqual(new Uint8Array());
    client.shutdown();
  });

  it('should accept a failing status the plugin explains in its own envelope', async () => {
    const client = loadNativePlugin(await compiledPlugin(), echoBridge());

    await expect(client.call('error.envelope', new Uint8Array())).resolves.toEqual(
      new TextEncoder().encode('{"ok":false}'),
    );
    client.shutdown();
  });

  it('should refuse a failing status the plugin leaves unexplained', async () => {
    const client = loadNativePlugin(await compiledPlugin(), echoBridge());

    for (const { method, code } of unexplainedFailures) {
      await expect(client.call(method, new Uint8Array())).rejects.toThrow(
        `plugin call ${method} returned ${String(code)}`,
      );
    }

    client.shutdown();
  });
});

describe.skipIf(process.platform === 'win32')('native plugin lifecycle', () => {
  it('should abandon a call the caller aborts while the plugin sits in the host', async () => {
    const cancellation = new AbortController();
    const client = loadNativePlugin(await compiledPlugin(), {
      call: () => {
        cancellation.abort();

        return new TextEncoder().encode('{"ok":true}');
      },
    });

    await expect(
      client.call('host.roundtrip', new Uint8Array(), cancellation.signal),
    ).rejects.toThrow('plugin call aborted');
    client.shutdown();
  });

  it('should stay closed when the host shuts the plugin down twice', async () => {
    const client = loadNativePlugin(await compiledPlugin(), echoBridge());

    client.shutdown();

    expect(() => {
      client.shutdown();
    }).not.toThrow();
  });

  it('should shut a plugin down that offers no shutdown hook', async () => {
    const client = loadNativePlugin(await compiledPlugin(['-DPLUGIN_SHUTDOWN=0']), echoBridge());

    expect(() => {
      client.shutdown();
    }).not.toThrow();
  });

  it('should ignore a host buffer release that names no pointer', async () => {
    const client = loadNativePlugin(await compiledPlugin(), echoBridge());

    await expect(client.call('host.freenothing', new Uint8Array())).resolves.toEqual(
      new TextEncoder().encode('{"ok":true,"result":{}}'),
    );
    client.shutdown();
  });
});

function echoBridge(): PluginHostBridge {
  return { call: (_method, request) => request };
}

async function compiledPlugin(flags: readonly string[] = []): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-native-variant-'));
  const source = join(directory, 'plugin.c');
  const library = join(directory, `sample${pluginLibraryExtension(process.platform)}`);
  const shared = process.platform === 'darwin' ? ['-dynamiclib'] : ['-shared', '-fPIC'];

  temporaryDirectories.push(directory);
  await writeFile(source, pluginSource, 'utf8');
  await executeCompiler([...shared, ...flags, '-o', library, source]);

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

const pluginSource = String.raw`
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#ifndef PLUGIN_ABI
#define PLUGIN_ABI 1
#endif
#ifndef INIT_RESULT
#define INIT_RESULT 0
#endif
#ifndef PLUGIN_TABLE
#define PLUGIN_TABLE 1
#endif
#ifndef PLUGIN_SHUTDOWN
#define PLUGIN_SHUTDOWN 1
#endif
#define EXPORT __attribute__((visibility("default")))
typedef struct { void *ptr; size_t len; } cliproxy_buffer;
typedef int (*host_call_fn)(void *, const char *, const uint8_t *, size_t, cliproxy_buffer *);
typedef void (*host_free_fn)(void *, size_t);
typedef struct { uint32_t abi_version; void *host_ctx; host_call_fn call; host_free_fn free_buffer; } host_api;
typedef int (*plugin_call_fn)(const char *, const uint8_t *, size_t, cliproxy_buffer *);
typedef void (*plugin_free_fn)(void *, size_t);
typedef void (*plugin_shutdown_fn)(void);
typedef struct { uint32_t abi_version; plugin_call_fn call; plugin_free_fn free_buffer; plugin_shutdown_fn shutdown; } plugin_api;
static const host_api *host;
static int answered(const char *body, int code, cliproxy_buffer *response) {
  size_t len = strlen(body);
  response->ptr = malloc(len);
  if (!response->ptr) return 1;
  memcpy(response->ptr, body, len);
  response->len = len;
  return code;
}
static int call_plugin(const char *method, const uint8_t *request, size_t len, cliproxy_buffer *response) {
  if (!strcmp(method, "empty.answer")) return 0;
  if (!strcmp(method, "error.envelope")) return answered("{\"ok\":false}", 1, response);
  if (!strcmp(method, "bad.status")) return answered("{\"ok\":true}", 2, response);
  if (!strcmp(method, "not.json")) return answered("nonsense", 3, response);
  if (!strcmp(method, "null.body")) return answered("null", 4, response);
  if (!strcmp(method, "plain.number")) return answered("123", 5, response);
  if (!strcmp(method, "no.ok")) return answered("{}", 6, response);
  if (!strcmp(method, "host.freenothing")) host->free_buffer(NULL, 0);
  if (!strcmp(method, "host.roundtrip")) {
    cliproxy_buffer echo = {0};
    int rc = host->call(host->host_ctx, "host.echo", request, len, &echo);
    host->free_buffer(echo.ptr, echo.len);
    if (rc != 0) return rc;
  }
  return answered("{\"ok\":true,\"result\":{}}", 0, response);
}
static void free_buffer(void *ptr, size_t len) { (void)len; free(ptr); }
static void shutdown_plugin(void) {}
EXPORT int cliproxy_plugin_init(const host_api *incoming, plugin_api *plugin) {
  host = incoming;
  plugin->abi_version = PLUGIN_ABI;
  plugin->call = PLUGIN_TABLE ? call_plugin : NULL;
  plugin->free_buffer = free_buffer;
  plugin->shutdown = PLUGIN_SHUTDOWN ? shutdown_plugin : NULL;
  return INIT_RESULT;
}
`;
