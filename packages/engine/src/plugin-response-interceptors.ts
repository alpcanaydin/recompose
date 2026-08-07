import type { PluginHost } from './plugin-host';
import type { PluginRoutingRecord } from './plugin-routing';
import type { PluginHeaderMap } from './plugin-wire';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import {
  interceptorField,
  interceptorStringList,
  mergedPluginHeaders,
} from './plugin-interceptor-headers';
import { pluginBytes, pluginHeaders } from './plugin-wire';

export type PluginResponseIntercept = {
  requestId: string;
  sourceFormat: string;
  model: string;
  requestedModel: string;
  requestHeaders: PluginHeaderMap;
  responseHeaders: PluginHeaderMap;
  originalRequest: Uint8Array;
  requestBody: Uint8Array;
  body: Uint8Array;
  statusCode: number;
  metadata: Record<string, unknown>;
};

export type PluginStreamChunkIntercept = Omit<PluginResponseIntercept, 'statusCode'> & {
  historyChunks: Uint8Array[];
  chunkIndex: number;
};

export type PluginResponseInterceptResult = {
  headers: PluginHeaderMap;
  body: Uint8Array;
};

export type PluginStreamChunkInterceptResult = PluginResponseInterceptResult & {
  dropChunk: boolean;
};

type InterceptorReply = PluginResponseInterceptResult & {
  clearHeaders: string[];
  dropChunk: boolean;
};

function replacedBody(current: Uint8Array, next: Uint8Array): Uint8Array {
  return next.length > 0 ? next : current;
}

function appliedResponse(
  current: PluginResponseInterceptResult,
  response: InterceptorReply,
): PluginResponseInterceptResult {
  return {
    headers: mergedPluginHeaders(current.headers, response.headers, response.clearHeaders),
    body: replacedBody(current.body, response.body),
  };
}

function appliedStreamResponse(
  current: PluginStreamChunkInterceptResult,
  response: InterceptorReply,
): PluginStreamChunkInterceptResult {
  return { ...appliedResponse(current, response), dropChunk: response.dropChunk };
}

function reply(value: unknown): InterceptorReply {
  if (!isJsonObject(value)) throw new Error('plugin response interceptor response is invalid');

  return {
    headers: pluginHeaders(interceptorField(value, 'headers', 'Headers')),
    body: pluginBytes(interceptorField(value, 'body', 'Body')),
    clearHeaders: interceptorStringList(interceptorField(value, 'clear_headers', 'ClearHeaders')),
    dropChunk: interceptorField(value, 'drop_chunk', 'DropChunk') === true,
  };
}

function baseWire(
  request: PluginResponseIntercept | PluginStreamChunkIntercept,
  headers: PluginHeaderMap,
  body: Uint8Array,
) {
  return {
    RequestID: request.requestId,
    SourceFormat: request.sourceFormat,
    Model: request.model,
    RequestedModel: request.requestedModel,
    RequestHeaders: structuredClone(request.requestHeaders),
    ResponseHeaders: structuredClone(headers),
    OriginalRequest: Buffer.from(request.originalRequest).toString('base64'),
    RequestBody: Buffer.from(request.requestBody).toString('base64'),
    Body: Buffer.from(body).toString('base64'),
    Metadata: structuredClone(request.metadata),
  };
}

function responseWire(
  request: PluginResponseIntercept,
  headers: PluginHeaderMap,
  body: Uint8Array,
) {
  return { ...baseWire(request, headers, body), Stream: false, StatusCode: request.statusCode };
}

function streamWire(
  request: PluginStreamChunkIntercept,
  headers: PluginHeaderMap,
  body: Uint8Array,
) {
  return {
    ...baseWire(request, headers, body),
    HistoryChunks: request.historyChunks.map((chunk) => Buffer.from(chunk).toString('base64')),
    ChunkIndex: request.chunkIndex,
  };
}

function records(
  host: PluginHost,
  capability: 'responseInterceptor' | 'streamChunkInterceptor',
  skip: string,
) {
  return host.routingRecords().filter((record) => record[capability] && record.id !== skip);
}

async function called(
  host: PluginHost,
  record: PluginRoutingRecord,
  method: string,
  request: unknown,
): Promise<InterceptorReply | null> {
  try {
    return await host.call(record.id, method, request, reply);
  } catch {
    return null;
  }
}

export async function interceptPluginResponse(
  host: PluginHost,
  request: PluginResponseIntercept,
  skipPluginId = '',
): Promise<PluginResponseInterceptResult> {
  let current: PluginResponseInterceptResult = {
    headers: structuredClone(request.responseHeaders),
    body: request.body.slice(),
  };

  for (const record of records(host, 'responseInterceptor', skipPluginId)) {
    const response = await called(
      host,
      record,
      pluginMethods.responseInterceptAfter,
      responseWire(request, current.headers, current.body),
    );

    if (response === null) continue;

    current = appliedResponse(current, response);
  }

  return current;
}

export async function interceptPluginStreamChunk(
  host: PluginHost,
  request: PluginStreamChunkIntercept,
  skipPluginId = '',
): Promise<PluginStreamChunkInterceptResult> {
  let current: PluginStreamChunkInterceptResult = {
    headers: structuredClone(request.responseHeaders),
    body: request.body.slice(),
    dropChunk: false,
  };

  for (const record of records(host, 'streamChunkInterceptor', skipPluginId)) {
    const response = await called(
      host,
      record,
      pluginMethods.responseInterceptStreamChunk,
      streamWire(request, current.headers, current.body),
    );

    if (response === null) continue;

    current = appliedStreamResponse(current, response);

    if (current.dropChunk) return current;
  }

  return current;
}
