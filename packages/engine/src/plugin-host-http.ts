import { spawnSync } from 'node:child_process';

import { isJsonObject, parsedJson } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { pluginBytes, pluginHeaders, webHeaders } from './plugin-wire';
import { providerObservability } from './provider/provider-observability';

export type PluginHostHTTPRequest = {
  method: string;
  url: string;
  headers: Record<string, string[]>;
  body: Uint8Array;
};

export type PluginHostHTTPResponse = {
  statusCode: number;
  headers: Record<string, string[]>;
  body: Uint8Array;
};

export type PluginHostHTTPTransport = (request: PluginHostHTTPRequest) => PluginHostHTTPResponse;

function field(value: Record<string, unknown>, lower: string, upper: string): unknown {
  return value[lower] ?? value[upper];
}

function safeHTTPURL(value: unknown): string {
  if (typeof value !== 'string' || !URL.canParse(value))
    throw new Error('host HTTP URL is invalid');

  if (!['http:', 'https:'].includes(new URL(value).protocol)) {
    throw new Error('host HTTP URL is unsafe');
  }

  return value;
}

function requestMethod(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value : 'GET';
}

function hostHTTPRequest(data: Uint8Array): PluginHostHTTPRequest {
  const parsed = parsedJson(new TextDecoder().decode(data));

  if (!isJsonObject(parsed)) throw new Error('host HTTP request is not an object');

  const method = field(parsed, 'method', 'Method');
  const url = field(parsed, 'url', 'URL');

  return {
    method: requestMethod(method),
    url: safeHTTPURL(url),
    headers: pluginHeaders(field(parsed, 'headers', 'Headers')),
    body: pluginBytes(field(parsed, 'body', 'Body')),
  };
}

function successEnvelope(response: PluginHostHTTPResponse): Uint8Array {
  return encoded({
    ok: true,
    result: {
      StatusCode: response.statusCode,
      Headers: response.headers,
      Body: Buffer.from(response.body).toString('base64'),
    },
  });
}

function errorEnvelope(code: string, message: string): Uint8Array {
  return encoded({ ok: false, error: { code, message } });
}

const childScript = String.raw`
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const headers = new Headers();
for (const [name, values] of Object.entries(request.headers || {})) {
  for (const value of values) headers.append(name, value);
}
try {
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: request.body === '' ? undefined : Buffer.from(request.body, 'base64'),
    redirect: 'follow'
  });
  const body = Buffer.from(await response.arrayBuffer()).toString('base64');
  const responseHeaders = {};
  response.headers.forEach((value, name) => { responseHeaders[name] = [value]; });
  process.stdout.write(JSON.stringify({ statusCode: response.status, headers: responseHeaders, body }));
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : 'host HTTP request failed');
  process.exitCode = 1;
}
`;

export function subprocessHostHTTP(request: PluginHostHTTPRequest): PluginHostHTTPResponse {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], {
    input: JSON.stringify({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.from(request.body).toString('base64'),
    }),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });

  const failure = childFailure(result.error, result.status, result.stderr);

  if (failure !== null) throw failure;

  return childResponse(result.stdout);
}

function childFailure(
  error: Error | undefined,
  status: number | null,
  stderr: string,
): Error | null {
  if (error !== undefined) return error;
  if (status !== 0) return new Error(stderr.trim() || 'host HTTP request failed');

  return null;
}

function childResponse(stdout: string): PluginHostHTTPResponse {
  const parsed = parsedJson(stdout);

  if (!isJsonObject(parsed) || typeof parsed['statusCode'] !== 'number') {
    throw new Error('host HTTP child returned an invalid response');
  }

  return {
    statusCode: parsed['statusCode'],
    headers: pluginHeaders(parsed['headers']),
    body: pluginBytes(parsed['body']),
  };
}

function observedTransport(
  pluginId: string,
  request: PluginHostHTTPRequest,
  transport: PluginHostHTTPTransport,
): PluginHostHTTPResponse {
  const span = providerObservability().start({
    provider: `plugin:${pluginId}`,
    model: '',
    dialect: 'chat-completions',
    method: request.method,
    url: request.url,
    headers: webHeaders(request.headers),
    body: request.body,
  });
  const response = transport(request);

  span.complete(response.statusCode, webHeaders(response.headers), response.body);

  return response;
}

export function pluginHostCallback(
  pluginId: string,
  method: string,
  data: Uint8Array,
  transport: PluginHostHTTPTransport,
): Uint8Array {
  if (method !== pluginMethods.hostHTTPDo) {
    return errorEnvelope('unknown_host_method', `host method ${method} is unavailable`);
  }

  try {
    return successEnvelope(observedTransport(pluginId, hostHTTPRequest(data), transport));
  } catch (failure) {
    return errorEnvelope(
      'host_call_failed',
      failure instanceof Error ? failure.message : 'host HTTP request failed',
    );
  }
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
