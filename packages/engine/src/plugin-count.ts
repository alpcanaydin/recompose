import type { SpendGrant } from '@recompose/contracts';

import type { JsonObject, ProviderDialect } from './gateway-wire';
import type { PluginHost } from './plugin-host';

import { translateRequest } from './dialect/dispatcher';
import { translateRequestToGemini } from './dialect/gemini-bridge';
import { ingressPayload, isJsonObject, jsonResponse, parsedJson } from './gateway-wire';
import { pluginAccountId, pluginCredential } from './plugin-auth';
import { pluginExecutorForProvider } from './plugin-executor';
import { selectedPluginDialect } from './plugin-gateway';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function providerOf(grant: ResolvedGrant): string | null {
  return grant.spend.custody === 'open' ? null : grant.spend.provider;
}

function translatedCountBody(
  raw: JsonObject,
  model: string,
  dialect: ProviderDialect,
): JsonObject | null {
  const payload = ingressPayload('anthropic', raw);

  if (payload === null) return null;

  const translated =
    dialect === 'gemini'
      ? translateRequestToGemini('anthropic', payload)
      : translateRequest('anthropic', dialect, payload);

  if ('refusal' in translated) return null;

  return 'outcome' in translated ? { ...raw, model } : { ...translated.value, model };
}

function tokenTotal(value: unknown): number | null {
  if (!isJsonObject(value)) return null;

  for (const key of ['input_tokens', 'total_tokens', 'totalTokens']) {
    const count = value[key];

    if (validTokenCount(count)) return count;
  }

  return null;
}

function validTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

async function countTarget(
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  plugins: PluginHost,
) {
  const provider = providerOf(grant);

  if (provider === null) return null;

  const adapter = await pluginExecutorForProvider(plugins, provider);

  if (adapter === null) return null;

  const inputDialect = selectedPluginDialect(adapter.formats().input, 'anthropic');

  if (inputDialect === null) return null;

  const body = translatedCountBody(raw, providerModel, inputDialect);

  return body === null ? null : { provider, adapter, inputDialect, body };
}

export async function pluginTokenCount(
  raw: JsonObject,
  grant: ResolvedGrant,
  providerModel: string,
  plugins?: PluginHost,
): Promise<Response | null> {
  if (plugins === undefined) return null;

  const target = await countTarget(raw, grant, providerModel, plugins);

  if (target === null) return null;

  const response = await target.adapter.countTokens({
    authId: pluginAccountId(grant),
    authProvider: target.provider,
    model: providerModel,
    format: 'anthropic',
    stream: false,
    alt: '',
    headers: {},
    query: {},
    originalRequest: new TextEncoder().encode(JSON.stringify(raw)),
    sourceFormat: target.inputDialect,
    payload: new TextEncoder().encode(JSON.stringify(target.body)),
    metadata: {},
    storageJSON: pluginCredential(grant),
    authMetadata: {},
    authAttributes: {},
  });
  const total = tokenTotal(parsedJson(new TextDecoder().decode(response.payload)));

  return total === null
    ? new Response(response.payload)
    : jsonResponse({ input_tokens: total }, 200);
}
