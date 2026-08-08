import type { Context } from 'hono';

import type { Crossing } from './gateway-wire';
import type { PluginHost } from './plugin-host';

import { requestHeaderMap } from './gateway-request-metadata';
import { InvalidJsonBodyError, isJsonObject, parsedJson } from './gateway-wire';
import { interceptPluginRequest } from './plugin-request-interceptors';
import { webHeaders } from './plugin-wire';

export type BeforePluginResult = { crossing: Crossing } | { response: Response };

function pluginBody(bytes: Uint8Array): Crossing['raw'] {
  const value = parsedJson(new TextDecoder().decode(bytes));

  if (!isJsonObject(value)) {
    throw new InvalidJsonBodyError('A request plugin returned a body that is not a JSON object.');
  }

  return value;
}

export async function beforeGatewayPlugins(
  c: Context,
  crossing: Crossing,
  plugins?: PluginHost,
): Promise<BeforePluginResult> {
  if (plugins === undefined) return { crossing };

  const requestId = crypto.randomUUID();
  const result = await interceptPluginRequest(plugins, 'before', {
    requestId,
    traceId: c.req.header('x-request-id') ?? '',
    sourceFormat: crossing.dialect,
    toFormat: '',
    model: crossing.providerModel,
    requestedModel: crossing.virtualModel,
    stream: crossing.raw['stream'] === true,
    headers: requestHeaderMap(c),
    body: new TextEncoder().encode(JSON.stringify(crossing.raw)),
    metadata: {},
  });

  if (result.terminate) {
    return {
      response: new Response(result.responseBody, {
        status: result.statusCode,
        headers: webHeaders(result.responseHeaders),
      }),
    };
  }

  return {
    crossing: {
      ...crossing,
      raw: pluginBody(result.body),
      requestHeaders: result.headers,
      pluginRequestId: requestId,
    },
  };
}
