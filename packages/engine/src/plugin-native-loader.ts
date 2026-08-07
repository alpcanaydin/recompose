import koffi, { type LibraryHandle, type TypeObject } from 'koffi';

import { pluginABIVersion, type PluginClient } from './plugin-abi';

export type PluginHostBridge = {
  call(method: string, request: Uint8Array): Uint8Array;
};

type NativeBuffer = { ptr: unknown; len: number | bigint };
type NativePluginAPI = {
  abi_version?: unknown;
  call?: unknown;
  free_buffer?: unknown;
  shutdown?: unknown;
};

const BufferType = koffi.struct('recompose_cliproxy_buffer', { ptr: 'void *', len: 'size_t' });
const HostCall = koffi.proto(
  'int recompose_host_call(void *ctx, const char *method, const void *request, size_t len, void *response)',
);
const HostFree = koffi.proto('void recompose_host_free(void *ptr, size_t len)');
const PluginCall = koffi.proto(
  'int recompose_plugin_call(const char *method, const uint8_t *request, size_t len, _Out_ recompose_cliproxy_buffer *response)',
);
const PluginFree = koffi.proto('void recompose_plugin_free(void *ptr, size_t len)');
const PluginShutdown = koffi.proto('void recompose_plugin_shutdown(void)');
const HostAPI = koffi.struct('recompose_cliproxy_host_api', {
  abi_version: 'uint32_t',
  host_ctx: 'void *',
  call: koffi.pointer(HostCall),
  free_buffer: koffi.pointer(HostFree),
});
const PluginAPI = koffi.struct('recompose_cliproxy_plugin_api', {
  abi_version: 'uint32_t',
  call: koffi.pointer(PluginCall),
  free_buffer: koffi.pointer(PluginFree),
  shutdown: koffi.pointer(PluginShutdown),
});

function called(pointer: unknown, prototype: TypeObject, values: readonly unknown[]): unknown {
  return Reflect.apply(koffi.call, undefined, [pointer, prototype, ...values]);
}

function pointerBytes(pointer: unknown, length: number | bigint): Uint8Array {
  const size = Number(length);

  return size > 0 ? new Uint8Array(koffi.view(pointer, size)).slice() : new Uint8Array();
}

function pointerPresent(pointer: unknown): boolean {
  return pointer !== null && pointer !== undefined && pointer !== 0n;
}

function aborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function requiredPluginAPI(api: NativePluginAPI): void {
  if (!pointerPresent(api.call) || !pointerPresent(api.free_buffer)) {
    throw new Error('plugin function table is incomplete');
  }
}

function freePluginResponse(api: NativePluginAPI, response: NativeBuffer): void {
  if (pointerPresent(response.ptr)) {
    called(api.free_buffer, PluginFree, [response.ptr, response.len]);
  }
}

function pluginErrorEnvelope(bytes: Uint8Array): boolean {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));

    return typeof value === 'object' && value !== null && Reflect.get(value, 'ok') === false;
  } catch {
    return false;
  }
}

function validateCallResult(method: string, result: number, output: Uint8Array): void {
  if (result !== 0 && !pluginErrorEnvelope(output)) {
    throw new Error(`plugin call ${method} returned ${String(result)}`);
  }
}

function callNativePlugin(
  api: NativePluginAPI,
  method: string,
  request: Uint8Array,
  signal?: AbortSignal,
): Uint8Array {
  if (aborted(signal)) throw new Error('plugin call aborted');

  requiredPluginAPI(api);
  const response: NativeBuffer = { ptr: null, len: 0 };
  const result = Number(called(api.call, PluginCall, [method, request, request.length, response]));
  const output = pointerPresent(response.ptr)
    ? pointerBytes(response.ptr, response.len)
    : new Uint8Array();

  freePluginResponse(api, response);

  if (aborted(signal)) throw new Error('plugin call aborted');

  validateCallResult(method, result, output);

  return output;
}

type HostCallbacks = { call: bigint; free: bigint; buffers: Map<string, Buffer> };

function writeHostResponse(response: unknown, output: Buffer): void {
  koffi.encode(response, BufferType, { ptr: output, len: output.length });
}

function hostCallbacks(bridge: PluginHostBridge): HostCallbacks {
  const buffers = new Map<string, Buffer>();
  const call = koffi.register(
    (
      _context: unknown,
      method: string,
      request: unknown,
      length: number | bigint,
      response: unknown,
    ) => {
      const output = Buffer.from(bridge.call(method, pointerBytes(request, length)));
      const key = koffi.address(output).toString();

      buffers.set(key, output);
      writeHostResponse(response, output);

      return 0;
    },
    koffi.pointer(HostCall),
  );
  const free = koffi.register((pointer: unknown) => {
    if (pointerPresent(pointer)) buffers.delete(String(pointer));
  }, koffi.pointer(HostFree));

  return { call, free, buffers };
}

function releaseCallbacks(callbacks: HostCallbacks): void {
  koffi.unregister(callbacks.call);
  koffi.unregister(callbacks.free);
  callbacks.buffers.clear();
}

class KoffiPluginClient implements PluginClient {
  private readonly library: LibraryHandle;
  private readonly api: NativePluginAPI;
  private readonly callbacks: HostCallbacks;
  private readonly hostAPI: unknown;
  private readonly hostContext: unknown;
  private closed = false;

  public constructor(
    library: LibraryHandle,
    api: NativePluginAPI,
    callbacks: HostCallbacks,
    hostAPI: unknown,
    hostContext: unknown,
  ) {
    this.library = library;
    this.api = api;
    this.callbacks = callbacks;
    this.hostAPI = hostAPI;
    this.hostContext = hostContext;
  }

  public async call(
    method: string,
    request: Uint8Array,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    if (this.closed) throw new Error('plugin client is closed');

    const output = await Promise.resolve().then(() =>
      callNativePlugin(this.api, method, request, signal),
    );

    return output;
  }

  public shutdown(): void {
    if (this.closed) return;

    this.closed = true;

    if (pointerPresent(this.api.shutdown)) called(this.api.shutdown, PluginShutdown, []);

    releaseCallbacks(this.callbacks);
    koffi.free(this.hostAPI);
    koffi.free(this.hostContext);
    this.library.unload();
  }
}

function initializedClient(library: LibraryHandle, bridge: PluginHostBridge): KoffiPluginClient {
  const initialize = library.func('cliproxy_plugin_init', 'int', [
    koffi.pointer(HostAPI),
    koffi.out(koffi.pointer(PluginAPI)),
  ]);
  const callbacks = hostCallbacks(bridge);
  const hostContext: unknown = koffi.alloc('uint8_t', 1);
  const hostAPI: unknown = koffi.alloc(HostAPI, 1);

  koffi.encode(hostAPI, HostAPI, {
    abi_version: pluginABIVersion,
    host_ctx: hostContext,
    call: callbacks.call,
    free_buffer: callbacks.free,
  });
  const pluginAPI: NativePluginAPI = {};

  try {
    const initialized: unknown = Reflect.apply(initialize, undefined, [hostAPI, pluginAPI]);
    const result = Number(initialized);

    if (result !== 0) throw new Error(`cliproxy_plugin_init returned ${String(result)}`);

    if (pluginAPI.abi_version !== pluginABIVersion) {
      throw new Error(`plugin ABI version ${String(pluginAPI.abi_version)} is not supported`);
    }

    requiredPluginAPI(pluginAPI);

    return new KoffiPluginClient(library, pluginAPI, callbacks, hostAPI, hostContext);
  } catch (failure) {
    releaseCallbacks(callbacks);
    koffi.free(hostAPI);
    koffi.free(hostContext);
    library.unload();

    throw failure;
  }
}

export function loadNativePlugin(path: string, bridge: PluginHostBridge): PluginClient {
  return initializedClient(koffi.load(path), bridge);
}
