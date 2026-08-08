import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';

export type PluginRoutingRecord = {
  id: string;
  priority: number;
  metadata: Record<string, unknown>;
  executor: boolean;
  executorModelScope: 'static' | 'oauth' | 'both';
  executorInputFormats: string[];
  executorOutputFormats: string[];
  scheduler: boolean;
  modelRouter: boolean;
  requestInterceptor: boolean;
  responseInterceptor: boolean;
  streamChunkInterceptor: boolean;
};

type SchedulerCandidate = {
  id: string;
  provider: string;
  priority: number;
  status: string;
  attributes: Record<string, string>;
  metadata: Record<string, unknown>;
};

export type SchedulerRequest = {
  provider: string;
  providers: string[];
  model: string;
  stream: boolean;
  headers: Record<string, string[]>;
  metadata: Record<string, unknown>;
  candidates: SchedulerCandidate[];
};

export type SchedulerDecision = {
  handled: boolean;
  authId?: string | undefined;
  delegateBuiltin?: 'round-robin' | 'fill-first' | undefined;
};

export type ModelRouteRequest = {
  sourceFormat: string;
  requestedModel: string;
  stream: boolean;
  headers: Record<string, string[]>;
  query: Record<string, string[]>;
  body: Uint8Array;
  metadata: Record<string, unknown>;
  availableProviders: string[];
};

export type ModelRouteDecision = {
  handled: boolean;
  pluginId?: string | undefined;
  targetKind?: 'self' | 'executor' | 'provider' | undefined;
  target?: string | undefined;
  targetModel?: string | undefined;
  reason?: string | undefined;
};

export type PluginRoutingHost = {
  routingRecords(): PluginRoutingRecord[];
  call<T>(
    id: string,
    method: string,
    request: unknown,
    decode: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T>;
};

function field(value: Record<string, unknown>, lower: string, upper: string): unknown {
  return value[lower] ?? value[upper];
}

function schedulerResponse(value: unknown): SchedulerDecision {
  if (!isJsonObject(value)) throw new Error('scheduler response is not an object');

  const authId = field(value, 'auth_id', 'AuthID');
  const delegate = field(value, 'delegate_builtin', 'DelegateBuiltin');
  const handled = field(value, 'handled', 'Handled') === true;

  return {
    handled,
    ...(typeof authId === 'string' ? { authId: authId.trim() } : {}),
    ...(typeof delegate === 'string' ? { delegateBuiltin: schedulerDelegate(delegate) } : {}),
  };
}

function schedulerDelegate(value: string): 'round-robin' | 'fill-first' | undefined {
  const normalized = value.trim();

  return normalized === 'round-robin' || normalized === 'fill-first' ? normalized : undefined;
}

function schedulerWire(record: PluginRoutingRecord, request: SchedulerRequest) {
  return {
    Plugin: structuredClone(record.metadata),
    Provider: request.provider,
    Providers: [...request.providers],
    Model: request.model,
    Stream: request.stream,
    Options: {
      Headers: structuredClone(request.headers),
      Metadata: structuredClone(request.metadata),
    },
    Candidates: request.candidates.map((candidate) => ({
      ID: candidate.id,
      Provider: candidate.provider,
      Priority: candidate.priority,
      Status: candidate.status,
      Attributes: structuredClone(candidate.attributes),
      Metadata: structuredClone(candidate.metadata),
    })),
  };
}

function validSchedulerDecision(
  decision: SchedulerDecision,
  candidates: readonly SchedulerCandidate[],
): boolean {
  if (!decision.handled) return false;

  if (decision.authId !== undefined) {
    return candidates.some(({ id }) => id.trim() === decision.authId);
  }

  return decision.delegateBuiltin !== undefined;
}

export async function pickPluginAuth(
  host: PluginRoutingHost,
  request: SchedulerRequest,
  signal?: AbortSignal,
): Promise<SchedulerDecision> {
  const record = host.routingRecords().find(({ scheduler }) => scheduler);

  if (record === undefined) return { handled: false };

  const decision = await host.call(
    record.id,
    pluginMethods.schedulerPick,
    schedulerWire(record, request),
    schedulerResponse,
    signal,
  );

  return validSchedulerDecision(decision, request.candidates) ? decision : { handled: false };
}

function routeKind(value: unknown): ModelRouteDecision['targetKind'] {
  return value === 'self' || value === 'executor' || value === 'provider' ? value : undefined;
}

function routeStrings(value: Record<string, unknown>): Partial<ModelRouteDecision> {
  const target = field(value, 'target', 'Target');
  const targetModel = field(value, 'target_model', 'TargetModel');
  const reason = field(value, 'reason', 'Reason');

  return {
    ...(typeof target === 'string' ? { target: target.trim() } : {}),
    ...(typeof targetModel === 'string' ? { targetModel: targetModel.trim() } : {}),
    ...(typeof reason === 'string' ? { reason } : {}),
  };
}

function routeResponse(value: unknown): ModelRouteDecision {
  if (!isJsonObject(value)) throw new Error('model route response is not an object');

  const handled = field(value, 'handled', 'Handled') === true;
  const kind = field(value, 'target_kind', 'TargetKind');

  return {
    handled,
    ...(routeKind(kind) === undefined ? {} : { targetKind: routeKind(kind) }),
    ...routeStrings(value),
  };
}

function routeWire(record: PluginRoutingRecord, request: ModelRouteRequest) {
  return {
    Plugin: structuredClone(record.metadata),
    PluginID: record.id,
    SourceFormat: request.sourceFormat,
    RequestedModel: request.requestedModel,
    Stream: request.stream,
    Headers: structuredClone(request.headers),
    Query: structuredClone(request.query),
    Body: Buffer.from(request.body).toString('base64'),
    Metadata: structuredClone(request.metadata),
    AvailableProviders: [...request.availableProviders],
  };
}

function selfTarget(
  decision: ModelRouteDecision,
  record: PluginRoutingRecord,
): ModelRouteDecision | null {
  return record.executor ? { ...decision, targetKind: 'self', target: record.id } : null;
}

function executorTarget(
  decision: ModelRouteDecision,
  records: readonly PluginRoutingRecord[],
): ModelRouteDecision | null {
  const target = records.find(({ id, executor }) => id === decision.target && executor);

  return target === undefined ? null : { ...decision, targetKind: 'executor', target: target.id };
}

function providerTarget(
  decision: ModelRouteDecision,
  providers: readonly string[],
): ModelRouteDecision | null {
  return decision.target !== undefined && providers.includes(decision.target)
    ? { ...decision, targetKind: 'provider' }
    : null;
}

function availableTarget(
  decision: ModelRouteDecision,
  record: PluginRoutingRecord,
  records: readonly PluginRoutingRecord[],
  providers: readonly string[],
): ModelRouteDecision | null {
  const kind = decision.targetKind ?? 'self';

  if (kind === 'self') return selfTarget(decision, record);
  if (kind === 'executor') return executorTarget(decision, records);

  return providerTarget(decision, providers);
}

function eligibleRouter(record: PluginRoutingRecord, skipPluginId: string): boolean {
  return record.modelRouter && record.id !== skipPluginId;
}

async function routeWithRecord(
  host: PluginRoutingHost,
  record: PluginRoutingRecord,
  records: readonly PluginRoutingRecord[],
  request: ModelRouteRequest,
  signal?: AbortSignal,
): Promise<ModelRouteDecision | null> {
  try {
    const decision = await host.call(
      record.id,
      pluginMethods.modelRoute,
      routeWire(record, request),
      routeResponse,
      signal,
    );

    return decision.handled
      ? availableTarget(decision, record, records, request.availableProviders)
      : null;
  } catch {
    return null;
  }
}

export async function routePluginModel(
  host: PluginRoutingHost,
  request: ModelRouteRequest,
  skipPluginId = '',
  signal?: AbortSignal,
): Promise<ModelRouteDecision> {
  const records = host.routingRecords();

  for (const record of records) {
    if (!eligibleRouter(record, skipPluginId)) continue;

    const available = await routeWithRecord(host, record, records, request, signal);

    if (available !== null) return { ...available, pluginId: record.id };
  }

  return { handled: false };
}
