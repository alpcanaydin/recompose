import type { ChatCompletionsRequest } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubReasoning, HubRequest } from './hub';

function mapped(fates: Fate[], field: string, to: string): void {
  fates.push({ field, disposition: 'mapped', to });
}

export function hubOptionsFromChat(
  request: ChatCompletionsRequest,
  fates: Fate[],
): Partial<HubRequest> {
  const options: Partial<HubRequest> = {};

  responseFormatFrom(request, options, fates);
  serviceTierFrom(request, options, fates);
  reasoningFrom(request, options, fates);
  modalitiesFrom(request, options, fates);
  parallelFrom(request, options, fates);
  generationConfigFrom(request, options, fates);

  return options;
}

function generationConfigFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  if (request.generationConfig === undefined) return;

  options.geminiGenerationConfig = normalizedGenerationConfig(request.generationConfig);
  mapped(fates, 'generationConfig', 'geminiGenerationConfig');
}

function normalizedGenerationConfig(config: Record<string, unknown>): Record<string, unknown> {
  const thinking = config['thinkingConfig'];

  if (!isRecord(thinking)) return config;

  const clean = { ...thinking };
  const include = clean['includeThoughts'] ?? clean['include_thoughts'];

  delete clean['includeThoughts'];
  delete clean['include_thoughts'];

  if (typeof include === 'boolean') clean['includeThoughts'] = include;

  return { ...config, thinkingConfig: clean };
}

function responseFormatFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  if (request.response_format === undefined) return;

  options.responseFormat = request.response_format;
  mapped(fates, 'response_format', 'responseFormat');
}

function serviceTierFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  if (request.service_tier === undefined) return;

  options.serviceTier = request.service_tier;
  mapped(fates, 'service_tier', 'serviceTier');
}

function reasoningFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  const reasoning = reasoningOption(request);

  if (reasoning === undefined) return;

  options.reasoning = reasoning;
  mapped(fates, 'reasoning_effort', 'reasoning.effort');
}

function reasoningOption(request: ChatCompletionsRequest): HubReasoning | undefined {
  const summary = thinkingSummary(request);
  const effort = request.reasoning_effort;

  if (effort === undefined && summary === undefined) return undefined;

  return {
    ...reasoningEffortField(effort),
    ...reasoningSummaryField(summary),
  };
}

function reasoningEffortField(effort: string | undefined): Pick<HubReasoning, 'effort'> | object {
  return effort === undefined ? {} : { effort };
}

function reasoningSummaryField(
  summary: boolean | undefined,
): Pick<HubReasoning, 'summary'> | object {
  if (summary === undefined) return {};

  return { summary: summary ? 'auto' : 'none' };
}

function thinkingSummary(request: ChatCompletionsRequest): boolean | undefined {
  const candidates = [
    googleThinking(request.extra_body),
    reasoningExclusion(request.reasoning),
    includeThoughts(request.thinking),
    includeThoughts(recordMember(request.generationConfig, 'thinkingConfig')),
    request.reasoning_effort === undefined ? undefined : true,
  ];

  return candidates.find((candidate) => candidate !== undefined);
}

function includeThoughts(value: unknown): boolean | undefined {
  if (!isRecord(value)) return undefined;

  const config = value;
  const include = config['includeThoughts'] ?? config['include_thoughts'];

  return typeof include === 'boolean' ? include : undefined;
}

function reasoningExclusion(value: unknown): boolean | undefined {
  if (!isRecord(value)) return undefined;

  const exclude = value['exclude'];

  return typeof exclude === 'boolean' ? !exclude : undefined;
}

function googleThinking(value: unknown): boolean | undefined {
  return includeThoughts(recordMember(recordMember(value, 'google'), 'thinking_config'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordMember(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function modalitiesFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  if (request.modalities === undefined) return;

  options.responseModalities = request.modalities;
  mapped(fates, 'modalities', 'responseModalities');
}

function parallelFrom(
  request: ChatCompletionsRequest,
  options: Partial<HubRequest>,
  fates: Fate[],
): void {
  if (request.parallel_tool_calls === undefined) return;

  options.parallelToolCalls = request.parallel_tool_calls;
  mapped(fates, 'parallel_tool_calls', 'parallelToolCalls');
}

export function chatOptionsInto(
  value: ChatCompletionsRequest,
  hub: HubRequest,
  fates: Fate[],
): void {
  formatInto(value, hub, fates);
  serviceInto(value, hub, fates);
  reasoningInto(value, hub, fates);
  modalitiesInto(value, hub, fates);
  parallelInto(value, hub, fates);
}

function formatInto(value: ChatCompletionsRequest, hub: HubRequest, fates: Fate[]): void {
  if (hub.responseFormat === undefined) return;

  value.response_format = hub.responseFormat;
  mapped(fates, 'responseFormat', 'response_format');
}

function serviceInto(value: ChatCompletionsRequest, hub: HubRequest, fates: Fate[]): void {
  if (hub.serviceTier === undefined) return;

  value.service_tier = hub.serviceTier;
  mapped(fates, 'serviceTier', 'service_tier');
}

function reasoningInto(value: ChatCompletionsRequest, hub: HubRequest, fates: Fate[]): void {
  if (hub.reasoning?.effort === undefined) return;

  value.reasoning_effort = hub.reasoning.effort;
  mapped(fates, 'reasoning.effort', 'reasoning_effort');
}

function modalitiesInto(value: ChatCompletionsRequest, hub: HubRequest, fates: Fate[]): void {
  if (hub.responseModalities === undefined) return;

  value.modalities = hub.responseModalities;
  mapped(fates, 'responseModalities', 'modalities');
}

function parallelInto(value: ChatCompletionsRequest, hub: HubRequest, fates: Fate[]): void {
  if (hub.parallelToolCalls === undefined) return;

  value.parallel_tool_calls = hub.parallelToolCalls;
  mapped(fates, 'parallelToolCalls', 'parallel_tool_calls');
}
