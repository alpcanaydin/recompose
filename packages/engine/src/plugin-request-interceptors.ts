import type { PluginRoutingHost, PluginRoutingRecord } from './plugin-routing';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import {
  interceptorField,
  interceptorStringList,
  mergedPluginHeaders,
} from './plugin-interceptor-headers';
import { pluginBytes, pluginHeaders, type PluginHeaderMap as HeaderMap } from './plugin-wire';

export type PluginRequestIntercept = {
  requestId: string;
  traceId: string;
  sourceFormat: string;
  toFormat: string;
  model: string;
  requestedModel: string;
  stream: boolean;
  headers: HeaderMap;
  body: Uint8Array;
  metadata: Record<string, unknown>;
};

export type PluginRequestInterceptResult = {
  headers: HeaderMap;
  body: Uint8Array;
  terminate: boolean;
  statusCode: number;
  responseHeaders: HeaderMap;
  responseBody: Uint8Array;
};

type InterceptorResponse = PluginRequestInterceptResult & { clearHeaders: string[] };

function statusCode(value: unknown): number {
  return typeof value === 'number' && value >= 100 && value <= 599 ? Math.trunc(value) : 403;
}

function interceptorResponse(value: unknown): InterceptorResponse {
  if (!isJsonObject(value)) throw new Error('plugin request interceptor response is invalid');

  return {
    headers: pluginHeaders(interceptorField(value, 'headers', 'Headers')),
    body: pluginBytes(interceptorField(value, 'body', 'Body')),
    clearHeaders: interceptorStringList(interceptorField(value, 'clear_headers', 'ClearHeaders')),
    terminate: interceptorField(value, 'terminate', 'Terminate') === true,
    statusCode: statusCode(interceptorField(value, 'status_code', 'StatusCode')),
    responseHeaders: pluginHeaders(interceptorField(value, 'response_headers', 'ResponseHeaders')),
    responseBody: pluginBytes(interceptorField(value, 'response_body', 'ResponseBody')),
  };
}

function requestWire(request: PluginRequestIntercept, headers_: HeaderMap, body: Uint8Array) {
  return {
    RequestID: request.requestId,
    TraceID: request.traceId,
    SourceFormat: request.sourceFormat,
    ToFormat: request.toFormat,
    Model: request.model,
    RequestedModel: request.requestedModel,
    Stream: request.stream,
    Headers: structuredClone(headers_),
    Body: Buffer.from(body).toString('base64'),
    Metadata: structuredClone(request.metadata),
  };
}

function requestInterceptors(host: PluginRoutingHost, skipPluginId: string): PluginRoutingRecord[] {
  return host
    .routingRecords()
    .filter((record) => record.requestInterceptor && record.id !== skipPluginId);
}

function initialResult(request: PluginRequestIntercept): PluginRequestInterceptResult {
  return {
    headers: structuredClone(request.headers),
    body: request.body.slice(),
    terminate: false,
    statusCode: 0,
    responseHeaders: {},
    responseBody: new Uint8Array(),
  };
}

function appliedResponse(
  current: PluginRequestInterceptResult,
  response: InterceptorResponse,
): PluginRequestInterceptResult {
  return {
    ...current,
    headers: mergedPluginHeaders(current.headers, response.headers, response.clearHeaders),
    body: response.body.length > 0 ? response.body : current.body,
    terminate: response.terminate,
    statusCode: response.statusCode,
    responseHeaders: structuredClone(response.responseHeaders),
    responseBody: response.responseBody.slice(),
  };
}

async function callInterceptor(
  host: PluginRoutingHost,
  record: PluginRoutingRecord,
  method: string,
  request: PluginRequestIntercept,
  current: PluginRequestInterceptResult,
): Promise<InterceptorResponse | null> {
  try {
    return await host.call(
      record.id,
      method,
      requestWire(request, current.headers, current.body),
      interceptorResponse,
    );
  } catch {
    return null;
  }
}

function interceptorMethod(stage: 'before' | 'after'): string {
  return stage === 'before'
    ? pluginMethods.requestInterceptBefore
    : pluginMethods.requestInterceptAfter;
}

export async function interceptPluginRequest(
  host: PluginRoutingHost,
  stage: 'before' | 'after',
  request: PluginRequestIntercept,
  skipPluginId = '',
): Promise<PluginRequestInterceptResult> {
  let current = initialResult(request);
  const method = interceptorMethod(stage);

  for (const record of requestInterceptors(host, skipPluginId)) {
    const response = await callInterceptor(host, record, method, request, current);

    if (response === null) continue;

    current = appliedResponse(current, response);

    if (current.terminate) return current;
  }

  return current;
}
