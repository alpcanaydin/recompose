import type { Crossing, ProviderDialect } from './gateway-wire';
import type { PluginHost } from './plugin-host';
import type { PluginHeaderMap } from './plugin-wire';

import { interceptPluginRequest } from './plugin-request-interceptors';
import { webHeaders } from './plugin-wire';

export type AfterAuthResult =
  | { headers: PluginHeaderMap; body: Uint8Array }
  | { response: Response };

export async function afterAuthPlugins(
  crossing: Crossing,
  toFormat: ProviderDialect,
  headers: PluginHeaderMap,
  body: Uint8Array,
  plugins?: PluginHost,
  skipPluginId = '',
): Promise<AfterAuthResult> {
  if (plugins === undefined) return { headers, body };

  const result = await interceptPluginRequest(
    plugins,
    'after',
    {
      requestId: crossing.pluginRequestId ?? crypto.randomUUID(),
      traceId: '',
      sourceFormat: crossing.dialect,
      toFormat,
      model: crossing.providerModel,
      requestedModel: crossing.virtualModel,
      stream: crossing.raw['stream'] === true,
      headers,
      body,
      metadata: {},
    },
    skipPluginId,
  );

  return result.terminate
    ? {
        response: new Response(result.responseBody, {
          status: result.statusCode,
          headers: webHeaders(result.responseHeaders),
        }),
      }
    : { headers: result.headers, body: result.body };
}

export function headerMap(values: Record<string, string>): PluginHeaderMap {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, [value]]));
}

export function flattenedHeaders(values: PluginHeaderMap): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([name, items]) => [name, items.join(', ')]),
  );
}
