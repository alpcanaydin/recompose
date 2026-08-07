import type { PluginRoutingHost, PluginRoutingRecord } from './plugin-routing';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';

export type PluginExecutorRequest = {
  authId: string;
  authProvider: string;
  model: string;
  format: string;
  stream: boolean;
  alt: string;
  headers: Record<string, string[]>;
  query: Record<string, string[]>;
  originalRequest: Uint8Array;
  sourceFormat: string;
  payload: Uint8Array;
  metadata: Record<string, unknown>;
  storageJSON: Uint8Array;
  authMetadata: Record<string, unknown>;
  authAttributes: Record<string, string>;
};

export type PluginExecutorResponse = {
  payload: Uint8Array;
  headers: Headers;
  metadata: Record<string, unknown>;
};

type PluginExecutorChunk = { payload: Uint8Array; error?: string | undefined };
export type PluginExecutorStream = { headers: Headers; chunks: PluginExecutorChunk[] };

function bytes(value: unknown): Uint8Array {
  if (typeof value === 'string') return Buffer.from(value, 'base64');

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return Uint8Array.from(value);
  }

  return new Uint8Array();
}

function headerValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function headers(value: unknown): Headers {
  const output = new Headers();

  if (!isJsonObject(value)) return output;

  for (const [name, raw] of Object.entries(value)) {
    for (const item of headerValues(raw)) output.append(name, item);
  }

  return output;
}

function record(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? structuredClone(value) : {};
}

function field(value: Record<string, unknown>, lower: string, upper: string): unknown {
  return value[lower] ?? value[upper];
}

function executorResponse(value: unknown): PluginExecutorResponse {
  if (!isJsonObject(value)) throw new Error('plugin executor response is not an object');

  return {
    payload: bytes(field(value, 'payload', 'Payload')),
    headers: headers(field(value, 'headers', 'Headers')),
    metadata: record(field(value, 'metadata', 'Metadata')),
  };
}

function streamChunk(value: unknown): PluginExecutorChunk | null {
  if (!isJsonObject(value)) return null;

  const error = field(value, 'error', 'Error');

  return {
    payload: bytes(field(value, 'payload', 'Payload')),
    ...(typeof error === 'string' && error !== '' ? { error } : {}),
  };
}

function executorStream(value: unknown): PluginExecutorStream {
  if (!isJsonObject(value)) throw new Error('plugin executor stream response is not an object');

  const rawChunks = field(value, 'chunks', 'Chunks');
  const chunks = Array.isArray(rawChunks)
    ? rawChunks.map(streamChunk).filter((chunk): chunk is PluginExecutorChunk => chunk !== null)
    : [];

  return { headers: headers(field(value, 'headers', 'Headers')), chunks };
}

function identifierResponse(value: unknown): string {
  if (!isJsonObject(value)) throw new Error('plugin executor identifier is not an object');

  const identifier = field(value, 'identifier', 'Identifier');

  if (typeof identifier !== 'string' || identifier.trim() === '') {
    throw new Error('plugin executor identifier is empty');
  }

  return identifier.trim().toLowerCase();
}

function executorWire(request: PluginExecutorRequest) {
  return {
    AuthID: request.authId,
    AuthProvider: request.authProvider,
    Model: request.model,
    Format: request.format,
    Stream: request.stream,
    Alt: request.alt,
    Headers: structuredClone(request.headers),
    Query: structuredClone(request.query),
    OriginalRequest: Buffer.from(request.originalRequest).toString('base64'),
    SourceFormat: request.sourceFormat,
    Payload: Buffer.from(request.payload).toString('base64'),
    Metadata: structuredClone(request.metadata),
    StorageJSON: Buffer.from(request.storageJSON).toString('base64'),
    AuthMetadata: structuredClone(request.authMetadata),
    AuthAttributes: structuredClone(request.authAttributes),
  };
}

function executorRecord(host: PluginRoutingHost, pluginId: string): PluginRoutingRecord {
  const found = host.routingRecords().find(({ id, executor }) => id === pluginId && executor);

  if (found === undefined) throw new Error(`plugin ${pluginId} has no active executor`);

  return found;
}

export class PluginExecutorAdapter {
  private readonly host: PluginRoutingHost;
  private readonly pluginId: string;

  public constructor(host: PluginRoutingHost, pluginId: string) {
    executorRecord(host, pluginId);
    this.host = host;
    this.pluginId = pluginId;
  }

  public formats(): { input: string[]; output: string[]; scope: 'static' | 'oauth' | 'both' } {
    const current = executorRecord(this.host, this.pluginId);

    return {
      input: [...current.executorInputFormats],
      output: [...current.executorOutputFormats],
      scope: current.executorModelScope,
    };
  }

  public async identifier(signal?: AbortSignal): Promise<string> {
    return this.host.call(this.pluginId, 'executor.identifier', {}, identifierResponse, signal);
  }

  public async execute(
    request: PluginExecutorRequest,
    signal?: AbortSignal,
  ): Promise<PluginExecutorResponse> {
    const response = await this.host.call(
      this.pluginId,
      pluginMethods.executorExecute,
      executorWire(request),
      executorResponse,
      signal,
    );

    return response;
  }

  public async executeStream(
    request: PluginExecutorRequest,
    signal?: AbortSignal,
  ): Promise<PluginExecutorStream> {
    const response = await this.host.call(
      this.pluginId,
      pluginMethods.executorStream,
      executorWire({ ...request, stream: true }),
      executorStream,
      signal,
    );

    return response;
  }

  public async countTokens(
    request: PluginExecutorRequest,
    signal?: AbortSignal,
  ): Promise<PluginExecutorResponse> {
    const response = await this.host.call(
      this.pluginId,
      pluginMethods.executorCountTokens,
      executorWire(request),
      executorResponse,
      signal,
    );

    return response;
  }
}
