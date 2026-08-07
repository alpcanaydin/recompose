import type { ChatCompletionsRequest } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubRequest } from './hub';

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

  return options;
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
  if (request.reasoning_effort === undefined) return;

  options.reasoning = { effort: request.reasoning_effort };
  mapped(fates, 'reasoning_effort', 'reasoning.effort');
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
