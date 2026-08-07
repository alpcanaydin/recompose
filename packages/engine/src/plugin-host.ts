import type { PluginClient, PluginRPCErrorShape } from './plugin-abi';

import { isJsonObject } from './gateway-wire';
import { callPlugin, lifecycleRequest, pluginMethods, pluginSchemaVersion } from './plugin-abi';
import { loadNativePlugin } from './plugin-native-loader';

type PluginCapabilities = {
  executor: boolean;
  scheduler: boolean;
  modelRouter: boolean;
  requestLifecycle: boolean;
  management: boolean;
};

export type PluginRegistration = {
  schemaVersion: number;
  metadata: Record<string, unknown>;
  capabilities: PluginCapabilities;
};

type PluginRecord = {
  id: string;
  priority: number;
  client: PluginClient;
  registration: PluginRegistration;
  fused: boolean;
};

type PluginLoader = (
  path: string,
  bridge: { call(method: string, request: Uint8Array): Uint8Array },
) => PluginClient;

function booleanAt(value: Record<string, unknown>, key: string): boolean {
  return value[key] === true;
}

function registrationSchemaVersion(value: Record<string, unknown>): number {
  const schemaVersion = value['schema_version'];

  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw new Error('plugin registration schema version is invalid');
  }

  return schemaVersion;
}

function registrationRecords(value: Record<string, unknown>): {
  metadata: Record<string, unknown>;
  capabilities: Record<string, unknown>;
} {
  const metadata = value['metadata'];
  const capabilities = value['capabilities'];

  if (!isJsonObject(metadata) || !isJsonObject(capabilities)) {
    throw new Error('plugin registration metadata or capabilities are invalid');
  }

  return { metadata, capabilities };
}

function registration(value: unknown): PluginRegistration {
  if (!isJsonObject(value)) throw new Error('plugin registration is not an object');

  const schemaVersion = registrationSchemaVersion(value);
  const { metadata, capabilities } = registrationRecords(value);

  return {
    schemaVersion,
    metadata: structuredClone(metadata),
    capabilities: {
      executor: booleanAt(capabilities, 'executor'),
      scheduler: booleanAt(capabilities, 'scheduler'),
      modelRouter: booleanAt(capabilities, 'model_router'),
      requestLifecycle: booleanAt(capabilities, 'request_lifecycle_plugin'),
      management: booleanAt(capabilities, 'management_api'),
    },
  };
}

function hostError(code: string, message: string): Uint8Array {
  const error: PluginRPCErrorShape = { code, message, retryable: false, httpStatus: 0 };

  return new TextEncoder().encode(JSON.stringify({ ok: false, error }));
}

export class PluginHost {
  private readonly plugins = new Map<string, PluginRecord>();
  private readonly loader: PluginLoader;

  public constructor(loader: PluginLoader = loadNativePlugin) {
    this.loader = loader;
  }

  public async load(
    id: string,
    path: string,
    config: Uint8Array = new Uint8Array(),
    priority = 0,
  ): Promise<PluginRegistration> {
    const existing = this.plugins.get(id);

    if (existing !== undefined) return this.reconfigure(existing, config, priority);

    const client = this.loader(path, {
      call: (method) => hostError('unknown_host_method', `host method ${method} is unavailable`),
    });

    try {
      const registered = await callPlugin(
        client,
        pluginMethods.register,
        lifecycleRequest(config),
        registration,
      );

      this.validateSchema(registered);
      this.plugins.set(id, { id, priority, client, registration: registered, fused: false });

      return registered;
    } catch (failure) {
      client.shutdown();

      throw failure;
    }
  }

  public disable(id: string): void {
    const record = this.plugins.get(id);

    if (record === undefined) return;

    this.plugins.delete(id);
    record.client.shutdown();
  }

  public shutdown(): void {
    for (const record of this.plugins.values()) record.client.shutdown();
    this.plugins.clear();
  }

  public registered(id: string): boolean {
    return this.plugins.has(id);
  }

  public snapshot(): PluginRegistration[] {
    return [...this.plugins.values()]
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
      .map(({ registration: current }) => structuredClone(current));
  }

  public async call<T>(
    id: string,
    method: string,
    request: unknown,
    decode: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    const record = this.activeRecord(id);

    try {
      return await callPlugin(record.client, method, request, decode, signal);
    } catch (failure) {
      this.fuse(record);

      throw failure;
    }
  }

  public completeRequest(id: string, completion: unknown): void {
    const record = this.plugins.get(id);

    if (
      record === undefined ||
      record.fused ||
      !record.registration.capabilities.requestLifecycle
    ) {
      return;
    }

    const cloned = structuredClone(completion);

    queueMicrotask(() => {
      void callPlugin(record.client, pluginMethods.requestComplete, cloned, (value) => value).catch(
        () => {
          this.fuse(record);
        },
      );
    });
  }

  private async reconfigure(
    record: PluginRecord,
    config: Uint8Array,
    priority: number,
  ): Promise<PluginRegistration> {
    const registered = await callPlugin(
      record.client,
      pluginMethods.reconfigure,
      lifecycleRequest(config),
      registration,
    );

    this.validateSchema(registered);
    record.registration = registered;
    record.priority = priority;
    record.fused = false;

    return registered;
  }

  private activeRecord(id: string): PluginRecord {
    const record = this.plugins.get(id);

    if (record === undefined) throw new Error(`plugin ${id} is not registered`);
    if (record.fused) throw new Error(`plugin ${id} is fused`);

    return record;
  }

  private fuse(record: PluginRecord): void {
    if (record.fused) return;

    record.fused = true;
    record.client.shutdown();
  }

  private validateSchema(registered: PluginRegistration): void {
    if (registered.schemaVersion > pluginSchemaVersion) {
      throw new Error(`plugin schema version ${String(registered.schemaVersion)} is not supported`);
    }
  }
}
