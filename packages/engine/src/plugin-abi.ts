import { isJsonObject, parsedJson } from './gateway-wire';

export const pluginABIVersion = 1;
export const pluginSchemaVersion = 2;

export const pluginMethods = {
  register: 'plugin.register',
  reconfigure: 'plugin.reconfigure',
  shutdown: 'plugin.shutdown',
  requestComplete: 'request.complete',
  executorExecute: 'executor.execute',
  executorStream: 'executor.execute_stream',
  executorCountTokens: 'executor.count_tokens',
  schedulerPick: 'scheduler.pick',
  modelRoute: 'model.route',
} as const;

export type PluginRPCErrorShape = {
  code: string;
  message: string;
  retryable: boolean;
  httpStatus: number;
};

type PluginEnvelope = { ok: true; result: unknown } | { ok: false; error: PluginRPCErrorShape };

export class PluginRPCError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly httpStatus: number;

  public constructor(error: PluginRPCErrorShape) {
    super(error.message === '' ? 'plugin call failed' : error.message);
    this.name = 'PluginRPCError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.httpStatus = error.httpStatus;
  }
}

function errorShape(value: unknown): PluginRPCErrorShape | null {
  if (!isJsonObject(value)) return null;

  return {
    code: typeof value['code'] === 'string' ? value['code'] : 'plugin_error',
    message: typeof value['message'] === 'string' ? value['message'] : 'plugin call failed',
    retryable: value['retryable'] === true,
    httpStatus: typeof value['http_status'] === 'number' ? value['http_status'] : 0,
  };
}

export function decodePluginEnvelope(bytes: Uint8Array): PluginEnvelope {
  const value = parsedJson(new TextDecoder().decode(bytes));

  if (!isJsonObject(value) || typeof value['ok'] !== 'boolean') {
    throw new Error('plugin response is not a valid RPC envelope');
  }

  if (value['ok']) return { ok: true, result: value['result'] };

  const error = errorShape(value['error']);

  if (error === null) throw new Error('plugin error envelope carries no error');

  return { ok: false, error };
}

export interface PluginClient {
  call(method: string, request: Uint8Array, signal?: AbortSignal): Promise<Uint8Array>;
  shutdown(): void;
}

export async function callPlugin<T>(
  client: PluginClient,
  method: string,
  request: unknown,
  decode: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  const encoded = new TextEncoder().encode(JSON.stringify(request));
  const envelope = decodePluginEnvelope(await client.call(method, encoded, signal));

  if (!envelope.ok) throw new PluginRPCError(envelope.error);

  return decode(envelope.result);
}

export function lifecycleRequest(config: Uint8Array): {
  config_yaml: string;
  schema_version: number;
} {
  return {
    config_yaml: Buffer.from(config).toString('base64'),
    schema_version: pluginSchemaVersion,
  };
}
