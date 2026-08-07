import type { ProviderDialect } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
};

export type ProviderRequestLog = {
  provider: string;
  model: string;
  accountId?: string | undefined;
  dialect: ProviderDialect;
  method: string;
  url: string;
  headers: Headers;
  body: Uint8Array;
  generate?: boolean | undefined;
};

export type ProviderObservation = ProviderRequestLog & {
  startedAt: number;
  durationMs: number;
  ttftMs: number;
  status: number;
  responseHeaders: Headers;
  usage: ProviderUsage;
  generate: boolean;
};

type ObservabilityOptions = {
  now?: (() => number) | undefined;
  maxRecords?: number | undefined;
};
type ObservationListener = (record: ProviderObservation) => void;

const emptyUsage = (): ProviderUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
});

function numberAt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function usageObject(body: unknown): Record<string, unknown> {
  return isJsonObject(body) && isJsonObject(body['usage']) ? body['usage'] : {};
}

function detailsAt(
  usage: Record<string, unknown>,
  primary: string,
  fallback: string,
): Record<string, unknown> {
  const preferred = usage[primary];
  const alternate = usage[fallback];

  if (isJsonObject(preferred)) return preferred;

  return isJsonObject(alternate) ? alternate : {};
}

function openAIUsage(body: unknown): ProviderUsage {
  const usage = usageObject(body);
  const input = numberAt(usage['prompt_tokens'] ?? usage['input_tokens']);
  const output = numberAt(usage['completion_tokens'] ?? usage['output_tokens']);
  const inputDetails = detailsAt(usage, 'input_tokens_details', 'prompt_tokens_details');
  const outputDetails = detailsAt(usage, 'output_tokens_details', 'completion_tokens_details');

  return {
    ...emptyUsage(),
    inputTokens: input,
    outputTokens: output,
    totalTokens: numberAt(usage['total_tokens']) || input + output,
    cacheReadTokens: numberAt(inputDetails['cached_tokens']),
    reasoningTokens: numberAt(outputDetails['reasoning_tokens']),
  };
}

function anthropicUsage(body: unknown): ProviderUsage {
  const usage = usageObject(body);
  const input = numberAt(usage['input_tokens']);
  const output = numberAt(usage['output_tokens']);
  const cacheRead = numberAt(usage['cache_read_input_tokens']);
  const cacheWrite = numberAt(usage['cache_creation_input_tokens']);
  const outputDetails = usage['output_tokens_details'];
  const reasoning = isJsonObject(outputDetails)
    ? numberAt(outputDetails['thinking_tokens'])
    : numberAt(usage['thinking_tokens']);

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output + cacheRead + cacheWrite,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: reasoning,
  };
}

function geminiUsage(body: unknown): ProviderUsage {
  const usage = isJsonObject(body) ? body['usageMetadata'] : undefined;

  if (!isJsonObject(usage)) return emptyUsage();

  const input = numberAt(usage['promptTokenCount']) + numberAt(usage['toolUsePromptTokenCount']);
  const output = numberAt(usage['candidatesTokenCount']);
  const reasoning = numberAt(usage['thoughtsTokenCount']);

  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: numberAt(usage['totalTokenCount']) || input + output + reasoning,
    cacheReadTokens: numberAt(usage['cachedContentTokenCount']),
    cacheWriteTokens: 0,
    reasoningTokens: reasoning,
  };
}

function parsedUsage(dialect: ProviderDialect, value: unknown): ProviderUsage {
  if (dialect === 'gemini') return geminiUsage(value);
  if (dialect === 'anthropic') return anthropicUsage(value);

  return openAIUsage(value);
}

function mergeUsage(current: ProviderUsage, next: ProviderUsage): ProviderUsage {
  return next.totalTokens === 0 ? current : next;
}

export function providerUsageFrom(dialect: ProviderDialect, text: string): ProviderUsage {
  const direct = parsedJson(text);

  if (direct !== undefined) return parsedUsage(dialect, direct);

  return text.split('\n').reduce((usage, line) => {
    if (!line.startsWith('data:')) return usage;

    const value = parsedJson(line.slice(5).trim());

    return mergeUsage(usage, parsedUsage(dialect, value));
  }, emptyUsage());
}

function clonedRequest(request: ProviderRequestLog): ProviderRequestLog {
  return {
    ...request,
    headers: new Headers(request.headers),
    body: request.body.slice(),
  };
}

export class ProviderObservability {
  private readonly records: ProviderObservation[] = [];
  private readonly listeners = new Set<ObservationListener>();
  private readonly options: ObservabilityOptions;

  public constructor(options: ObservabilityOptions = {}) {
    this.options = options;
  }

  public start(request: ProviderRequestLog): ProviderObservationSpan {
    return new ProviderObservationSpan(this, clonedRequest(request), this.now());
  }

  public snapshot(): ProviderObservation[] {
    return this.records.map((record) => ({
      ...record,
      headers: new Headers(record.headers),
      responseHeaders: new Headers(record.responseHeaders),
      body: record.body.slice(),
    }));
  }

  public popOldest(count: number): ProviderObservation[] {
    if (!Number.isInteger(count) || count <= 0) throw new RangeError('count must be positive');

    return this.records.splice(0, count);
  }

  public clear(): void {
    this.records.splice(0);
  }

  public subscribe(listener: ObservationListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(record: ProviderObservation): void {
    this.records.push(record);
    const excess = this.records.length - (this.options.maxRecords ?? 10_000);

    if (excess > 0) this.records.splice(0, excess);

    for (const listener of this.listeners) listener(record);
  }

  public now(): number {
    return this.options.now?.() ?? performance.now();
  }
}

export class ProviderObservationSpan {
  private readonly owner: ProviderObservability;
  private readonly request: ProviderRequestLog;
  private readonly startedAt: number;

  public constructor(owner: ProviderObservability, request: ProviderRequestLog, startedAt: number) {
    this.owner = owner;
    this.request = request;
    this.startedAt = startedAt;
  }

  public observe(response: Response): Response {
    const headers = new Headers(response.headers);

    if (response.body === null) {
      this.finish(response.status, headers, 0, emptyUsage());

      return response;
    }

    const decoder = new TextDecoder();
    const text: string[] = [];
    let ttft = 0;
    const observed = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform: (chunk, controller) => {
          if (ttft === 0) ttft = this.owner.now() - this.startedAt;
          text.push(decoder.decode(chunk, { stream: true }));
          controller.enqueue(chunk);
        },
        flush: () => {
          text.push(decoder.decode());
          this.finish(
            response.status,
            headers,
            ttft,
            providerUsageFrom(this.request.dialect, text.join('')),
          );
        },
      }),
    );

    return new Response(observed, response);
  }

  private finish(status: number, headers: Headers, ttftMs: number, usage: ProviderUsage): void {
    this.owner.publish({
      ...this.request,
      startedAt: this.startedAt,
      durationMs: this.owner.now() - this.startedAt,
      ttftMs,
      status,
      responseHeaders: new Headers(headers),
      usage,
      generate: this.request.generate ?? true,
    });
  }
}

const sharedObservability = new ProviderObservability();

export function providerObservability(): ProviderObservability {
  return sharedObservability;
}
