import type { SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';
import type { PluginHost } from './plugin-host';

import { requestHeaderMap, requestQueryMap } from './gateway-request-metadata';
import { afterAuthPlugins } from './plugin-after-auth';
import { pluginAccountId, pluginCredential } from './plugin-auth';
import { notePluginExecution } from './plugin-execution-context';
import { PluginExecutorAdapter, pluginExecutorForProvider } from './plugin-executor';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

export type PluginGatewayTarget =
  | {
      kind: 'executor';
      adapter: PluginExecutorAdapter;
      inputDialect: ProviderDialect;
      outputDialect: ProviderDialect;
    }
  | { kind: 'provider'; providerModel?: string | undefined };

function providerOf(grant: ResolvedGrant): string | null {
  return grant.spend.custody === 'open' ? null : grant.spend.provider;
}

const pluginFormats = new Map<string, ProviderDialect>([
  ['openai', 'chat-completions'],
  ['chat-completions', 'chat-completions'],
  ['openai-response', 'responses'],
  ['responses', 'responses'],
  ['claude', 'anthropic'],
  ['anthropic', 'anthropic'],
  ['gemini', 'gemini'],
  ['interactions', 'interactions'],
  ['gemini-interactions', 'interactions'],
]);

function pluginDialectFor(value: string): ProviderDialect | null {
  return pluginFormats.get(value.trim().toLowerCase()) ?? null;
}

export function selectedPluginDialect(
  formats: readonly string[],
  preferred: ProxyDialect,
): ProviderDialect | null {
  const supported = formats
    .map(pluginDialectFor)
    .filter((format): format is ProviderDialect => format !== null);

  return supported.includes(preferred) ? preferred : (supported[0] ?? null);
}

function executorTarget(
  adapter: PluginExecutorAdapter,
  crossing: Crossing,
): PluginGatewayTarget | null {
  const formats = adapter.formats();
  const inputDialect = selectedPluginDialect(formats.input, crossing.dialect);
  const outputDialect = selectedPluginDialect(formats.output, crossing.dialect);

  return inputDialect === null || outputDialect === null
    ? null
    : { kind: 'executor', adapter, inputDialect, outputDialect };
}

function providerDecisionTarget(
  target: string | undefined,
  targetModel: string | undefined,
  provider: string | null,
): PluginGatewayTarget | null {
  return target === provider ? { kind: 'provider', providerModel: targetModel } : null;
}

function executorDecisionTarget(
  pluginId: string | undefined,
  crossing: Crossing,
  plugins: PluginHost,
): PluginGatewayTarget | null {
  return pluginId === undefined
    ? null
    : executorTarget(new PluginExecutorAdapter(plugins, pluginId), crossing);
}

async function routedTarget(
  c: Context,
  crossing: Crossing,
  grant: ResolvedGrant,
  plugins: PluginHost,
): Promise<PluginGatewayTarget | null> {
  const provider = providerOf(grant);
  const decision = await plugins.routeModel({
    sourceFormat: crossing.dialect,
    requestedModel: crossing.virtualModel,
    stream: crossing.raw['stream'] === true,
    headers: requestHeaderMap(c),
    query: requestQueryMap(c),
    body: new TextEncoder().encode(JSON.stringify(crossing.raw)),
    metadata: {},
    availableProviders: provider === null ? [] : [provider],
  });

  if (!decision.handled) return null;

  if (decision.targetKind === 'provider') {
    return providerDecisionTarget(decision.target, decision.targetModel, provider);
  }

  return executorDecisionTarget(decision.target, crossing, plugins);
}

export async function pluginGatewayTarget(
  c: Context,
  crossing: Crossing,
  grant: ResolvedGrant,
  plugins?: PluginHost,
): Promise<PluginGatewayTarget | null> {
  if (plugins === undefined) return null;

  crossing.requestHeaders = requestHeaderMap(c);
  crossing.requestQuery = requestQueryMap(c);

  const routed = await routedTarget(c, crossing, grant, plugins);

  if (routed !== null) return routed;

  const provider = providerOf(grant);

  if (provider === null) return null;

  const adapter = await pluginExecutorForProvider(plugins, provider);

  return adapter === null ? null : executorTarget(adapter, crossing);
}

function pluginResponseStream(
  chunks: readonly { payload: Uint8Array; error?: string | undefined }[],
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        if (chunk.error !== undefined) {
          controller.error(new Error(chunk.error));

          return;
        }

        controller.enqueue(chunk.payload);
      }

      controller.close();
    },
  });
}

function streamResponse(
  chunks: readonly { payload: Uint8Array; error?: string | undefined }[],
  incoming: Headers,
): Response {
  const headers = new Headers(incoming);

  if (!headers.has('content-type')) headers.set('content-type', 'text/event-stream');

  return new Response(pluginResponseStream(chunks), { headers });
}

function directResponse(payload: Uint8Array, incoming: Headers): Response {
  const headers = new Headers(incoming);

  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  return new Response(payload, { headers });
}

async function preparedExecutorRequest(
  target: Extract<PluginGatewayTarget, { kind: 'executor' }>,
  crossing: Crossing,
  request: Parameters<PluginExecutorAdapter['execute']>[0],
  plugins?: PluginHost,
): Promise<
  { bodyChanged: boolean; request: Parameters<PluginExecutorAdapter['execute']>[0] } | Response
> {
  const intercepted = await afterAuthPlugins(
    crossing,
    target.inputDialect,
    request.headers,
    request.payload,
    plugins,
    target.adapter.id(),
  );

  return 'response' in intercepted
    ? intercepted.response
    : {
        bodyChanged: !sameBytes(intercepted.body, request.payload),
        request: { ...request, headers: intercepted.headers, payload: intercepted.body },
      };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function executorRequest(
  target: Extract<PluginGatewayTarget, { kind: 'executor' }>,
  crossing: Crossing,
  grant: ResolvedGrant,
  body: JsonObject,
): Parameters<PluginExecutorAdapter['execute']>[0] {
  return {
    authId: pluginAccountId(grant),
    authProvider: providerOf(grant) ?? '',
    model: crossing.providerModel,
    format: target.outputDialect,
    stream: crossing.raw['stream'] === true,
    alt: '',
    headers: crossing.requestHeaders ?? {},
    query: crossing.requestQuery ?? {},
    originalRequest: new TextEncoder().encode(JSON.stringify(crossing.raw)),
    sourceFormat: target.inputDialect,
    payload: new TextEncoder().encode(JSON.stringify(body)),
    metadata: {},
    storageJSON: pluginCredential(grant),
    authMetadata: {},
    authAttributes: {},
  };
}

export async function reachPluginExecutor(
  target: Extract<PluginGatewayTarget, { kind: 'executor' }>,
  crossing: Crossing,
  grant: ResolvedGrant,
  body: JsonObject,
  plugins?: PluginHost,
): Promise<Response> {
  const request = executorRequest(target, crossing, grant, body);
  const intercepted = await preparedExecutorRequest(target, crossing, request, plugins);

  if (intercepted instanceof Response) return intercepted;
  const prepared = intercepted.request;

  notePluginExecution(
    crossing,
    prepared.headers,
    prepared.payload,
    intercepted.bodyChanged,
    target.adapter.id(),
  );

  if (prepared.stream) {
    const response = await target.adapter.executeStream(prepared);

    return streamResponse(response.chunks, response.headers);
  }

  const response = await target.adapter.execute(prepared);

  return directResponse(response.payload, response.headers);
}
