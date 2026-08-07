import type { Crossing, ProviderDialect } from './gateway-wire';
import type { PluginHost } from './plugin-host';
import type {
  PluginResponseIntercept,
  PluginStreamChunkIntercept,
} from './plugin-response-interceptors';
import type { PluginHeaderMap } from './plugin-wire';

import { answerFrom } from './gateway-answers';
import {
  interceptPluginResponse,
  interceptPluginStreamChunk,
} from './plugin-response-interceptors';
import { webHeaders } from './plugin-wire';

const HEADER_INIT_INDEX = -1;
const HISTORY_CHUNK_LIMIT = 64;
const HISTORY_BYTE_LIMIT = 1024 * 1024;

function pluginHeaders(headers: Headers): PluginHeaderMap {
  return Object.fromEntries([...headers.entries()].map(([name, value]) => [name, [value]]));
}

function rawRequest(crossing: Crossing): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(crossing.raw));
}

function executionHeaders(crossing: Crossing): PluginHeaderMap {
  return structuredClone(crossing.pluginExecution?.requestHeaders ?? crossing.requestHeaders ?? {});
}

function executionOriginalRequest(crossing: Crossing, fallback: Uint8Array): Uint8Array {
  return crossing.pluginExecution?.originalRequest.slice() ?? fallback;
}

function executionRequestBody(crossing: Crossing, fallback: Uint8Array): Uint8Array {
  return crossing.pluginExecution?.requestBody.slice() ?? fallback;
}

function responseRequest(
  crossing: Crossing,
  responseHeaders: PluginHeaderMap,
  body: Uint8Array,
  statusCode: number,
): PluginResponseIntercept {
  const fallback = rawRequest(crossing);

  return {
    requestId: crossing.pluginRequestId ?? crypto.randomUUID(),
    sourceFormat: crossing.dialect,
    model: crossing.providerModel,
    requestedModel: crossing.virtualModel,
    requestHeaders: executionHeaders(crossing),
    responseHeaders,
    originalRequest: executionOriginalRequest(crossing, fallback),
    requestBody: executionRequestBody(crossing, fallback.slice()),
    body,
    statusCode,
    metadata: {},
  };
}

function streamRequest(
  base: PluginResponseIntercept,
  responseHeaders: PluginHeaderMap,
  body: Uint8Array,
  historyChunks: readonly Uint8Array[],
  chunkIndex: number,
): PluginStreamChunkIntercept {
  return {
    ...base,
    responseHeaders,
    body,
    historyChunks: historyChunks.map((chunk) => chunk.slice()),
    chunkIndex,
  };
}

function historyBytes(history: readonly Uint8Array[]): number {
  return history.reduce((total, chunk) => total + chunk.byteLength, 0);
}

function appendedHistory(history: readonly Uint8Array[], chunk: Uint8Array): Uint8Array[] {
  const next = [...history.map((item) => item.slice()), chunk.slice()];

  while (next.length > HISTORY_CHUNK_LIMIT || historyBytes(next) > HISTORY_BYTE_LIMIT) next.shift();

  return next;
}

function hasCapability(
  plugins: PluginHost,
  capability: 'responseInterceptor' | 'streamChunkInterceptor',
): boolean {
  return plugins.routingRecords().some((record) => record[capability]);
}

function interceptedBody(
  body: ReadableStream<Uint8Array>,
  base: PluginResponseIntercept,
  headers: PluginHeaderMap,
  plugins: PluginHost,
  skipPluginId: string,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let currentHeaders = structuredClone(headers);
  let history: Uint8Array[] = [];
  let chunkIndex = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const step = await reader.read();

        if (step.done) {
          controller.close();

          return;
        }

        const intercepted = await interceptPluginStreamChunk(
          plugins,
          streamRequest(base, currentHeaders, step.value, history, chunkIndex),
          skipPluginId,
        );

        currentHeaders = intercepted.headers;
        chunkIndex += 1;

        if (intercepted.dropChunk) continue;

        history = appendedHistory(history, intercepted.body);
        controller.enqueue(intercepted.body);

        return;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

async function streamResponse(
  crossing: Crossing,
  response: Response,
  plugins: PluginHost,
): Promise<Response> {
  if (response.body === null || !hasCapability(plugins, 'streamChunkInterceptor')) return response;

  const headers = pluginHeaders(response.headers);
  const base = responseRequest(crossing, headers, new Uint8Array(), response.status);
  const skipPluginId = crossing.pluginExecution?.skipPluginId ?? '';
  const initialized = await interceptPluginStreamChunk(
    plugins,
    streamRequest(base, headers, new Uint8Array(), [], HEADER_INIT_INDEX),
    skipPluginId,
  );

  return new Response(
    interceptedBody(response.body, base, initialized.headers, plugins, skipPluginId),
    { status: response.status, headers: webHeaders(initialized.headers) },
  );
}

async function directResponse(
  crossing: Crossing,
  response: Response,
  plugins: PluginHost,
): Promise<Response> {
  if (!hasCapability(plugins, 'responseInterceptor')) return response;

  const body = new Uint8Array(await response.arrayBuffer());
  const intercepted = await interceptPluginResponse(
    plugins,
    responseRequest(crossing, pluginHeaders(response.headers), body, response.status),
    crossing.pluginExecution?.skipPluginId ?? '',
  );

  return new Response(intercepted.body, {
    status: response.status,
    headers: webHeaders(intercepted.headers),
  });
}

async function afterGatewayResponsePlugins(
  crossing: Crossing,
  response: Response,
  plugins?: PluginHost,
): Promise<Response> {
  if (!interceptable(crossing, response, plugins)) return response;

  return response.headers.get('content-type')?.includes('text/event-stream') === true
    ? streamResponse(crossing, response, plugins)
    : directResponse(crossing, response, plugins);
}

export async function answerThroughPlugins(
  crossing: Crossing,
  upstream: Response,
  dialect: ProviderDialect,
  plugins?: PluginHost,
): Promise<Response> {
  return afterGatewayResponsePlugins(
    crossing,
    await answerFrom(crossing, upstream, dialect),
    plugins,
  );
}

function interceptable(
  crossing: Crossing,
  response: Response,
  plugins: PluginHost | undefined,
): plugins is PluginHost {
  return plugins !== undefined && crossing.pluginExecution !== undefined && response.ok;
}
