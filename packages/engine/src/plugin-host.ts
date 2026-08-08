import type { PluginClient } from './plugin-abi';

import { isJsonObject } from './gateway-wire';
import { callPlugin, lifecycleRequest, pluginMethods, pluginSchemaVersion } from './plugin-abi';
import {
  pluginHostCallback,
  type PluginHostHTTPTransport,
  subprocessHostHTTP,
} from './plugin-host-http';
import { loadNativePlugin } from './plugin-native-loader';
import {
  type ModelRouteDecision,
  type ModelRouteRequest,
  pickPluginAuth,
  type PluginRoutingRecord,
  routePluginModel,
  type SchedulerDecision,
  type SchedulerRequest,
} from './plugin-routing';

type PluginCapabilities = {
  executor: boolean;
  executorModelScope: 'static' | 'oauth' | 'both';
  executorInputFormats: string[];
  executorOutputFormats: string[];
  scheduler: boolean;
  modelRouter: boolean;
  requestLifecycle: boolean;
  requestInterceptor: boolean;
  responseInterceptor: boolean;
  streamChunkInterceptor: boolean;
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

function stringArrayAt(value: Record<string, unknown>, key: string): string[] {
  const list = value[key];

  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
}

function executorScope(value: unknown): 'static' | 'oauth' | 'both' {
  return value === 'static' || value === 'oauth' || value === 'both' ? value : 'both';
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
      executorModelScope: executorScope(capabilities['executor_model_scope']),
      executorInputFormats: stringArrayAt(capabilities, 'executor_input_formats'),
      executorOutputFormats: stringArrayAt(capabilities, 'executor_output_formats'),
      scheduler: booleanAt(capabilities, 'scheduler'),
      modelRouter: booleanAt(capabilities, 'model_router'),
      requestLifecycle: booleanAt(capabilities, 'request_lifecycle_plugin'),
      requestInterceptor: booleanAt(capabilities, 'request_interceptor'),
      responseInterceptor: booleanAt(capabilities, 'response_interceptor'),
      streamChunkInterceptor: booleanAt(capabilities, 'response_stream_interceptor'),
      management: booleanAt(capabilities, 'management_api'),
    },
  };
}

export class PluginHost {
  private readonly plugins = new Map<string, PluginRecord>();
  private readonly loader: PluginLoader;
  private readonly hostHTTP: PluginHostHTTPTransport;

  public constructor(
    loader: PluginLoader = loadNativePlugin,
    hostHTTP: PluginHostHTTPTransport = subprocessHostHTTP,
  ) {
    this.loader = loader;
    this.hostHTTP = hostHTTP;
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
      call: (method, request) => pluginHostCallback(id, method, request, this.hostHTTP),
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

  public routingRecords(): PluginRoutingRecord[] {
    return [...this.plugins.values()]
      .filter(({ fused }) => !fused)
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
      .map((record) => ({
        id: record.id,
        priority: record.priority,
        metadata: structuredClone(record.registration.metadata),
        ...record.registration.capabilities,
      }));
  }

  public async pickAuth(
    request: SchedulerRequest,
    signal?: AbortSignal,
  ): Promise<SchedulerDecision> {
    const decision = await pickPluginAuth(this, request, signal);

    return decision;
  }

  public async routeModel(
    request: ModelRouteRequest,
    skipPluginId = '',
    signal?: AbortSignal,
  ): Promise<ModelRouteDecision> {
    const decision = await routePluginModel(this, request, skipPluginId, signal);

    return decision;
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
