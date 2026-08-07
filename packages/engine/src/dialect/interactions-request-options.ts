import type { HubReasoning, HubRequest } from './hub';
import type { InteractionsRequest } from './interactions-wire';

import {
  geminiConfigFromInteractions,
  geminiConfigIntoInteractions,
} from './gemini-generation-config';

function reasoningFrom(request: InteractionsRequest): HubReasoning | undefined {
  if (request.generation_config === undefined && request.reasoning === undefined) return undefined;

  const reasoning: HubReasoning = {};

  applyReasoningEffort(reasoning, request);
  applyReasoningSummary(reasoning, request);
  applyReasoningBudget(reasoning, request);

  return nonEmptyReasoning(reasoning);
}

function applyReasoningEffort(reasoning: HubReasoning, request: InteractionsRequest): void {
  const effort = request.generation_config?.thinking_level ?? request.reasoning?.effort;

  if (effort !== undefined) reasoning.effort = effort;
}

function applyReasoningSummary(reasoning: HubReasoning, request: InteractionsRequest): void {
  const summary = request.generation_config?.thinking_summaries ?? request.reasoning?.summary;

  if (summary !== undefined) reasoning.summary = summary;
}

function applyReasoningBudget(reasoning: HubReasoning, request: InteractionsRequest): void {
  const budget = request.generation_config?.thinking_budget;

  if (budget !== undefined) reasoning.budgetTokens = budget;
}

function nonEmptyReasoning(reasoning: HubReasoning): HubReasoning | undefined {
  return Object.keys(reasoning).length === 0 ? undefined : reasoning;
}

function previousOption(
  request: InteractionsRequest,
): Pick<HubRequest, 'previousResponseId'> | object {
  return request.previous_interaction_id === undefined
    ? {}
    : { previousResponseId: request.previous_interaction_id };
}

function reasoningOption(request: InteractionsRequest): Pick<HubRequest, 'reasoning'> | object {
  const reasoning = reasoningFrom(request);

  return reasoning === undefined ? {} : { reasoning };
}

function modalitiesOption(
  request: InteractionsRequest,
): Pick<HubRequest, 'responseModalities'> | object {
  return request.response_modalities === undefined
    ? {}
    : { responseModalities: request.response_modalities };
}

function formatOption(request: InteractionsRequest): Pick<HubRequest, 'responseFormat'> | object {
  return request.response_format === undefined ? {} : { responseFormat: request.response_format };
}

function serviceOption(request: InteractionsRequest): Pick<HubRequest, 'serviceTier'> | object {
  return request.service_tier === undefined ? {} : { serviceTier: request.service_tier };
}

export function hubOptionsFromInteractions(request: InteractionsRequest): Partial<HubRequest> {
  return {
    ...previousOption(request),
    ...reasoningOption(request),
    ...modalitiesOption(request),
    ...formatOption(request),
    ...serviceOption(request),
    ...geminiConfigFromInteractions(request),
  };
}

function generationConfig(value: InteractionsRequest) {
  value.generation_config ??= {};

  return value.generation_config;
}

function previousInto(value: InteractionsRequest, request: HubRequest): void {
  if (request.previousResponseId !== undefined) {
    value.previous_interaction_id = request.previousResponseId;
  }
}

function reasoningInto(value: InteractionsRequest, request: HubRequest): void {
  if (request.reasoning === undefined) return;

  const config = generationConfig(value);

  if (request.reasoning.effort !== undefined) config.thinking_level = request.reasoning.effort;
  if (request.reasoning.summary !== undefined)
    config.thinking_summaries = request.reasoning.summary;

  if (request.reasoning.budgetTokens !== undefined) {
    config.thinking_budget = request.reasoning.budgetTokens;
  }
}

function modalitiesInto(value: InteractionsRequest, request: HubRequest): void {
  if (request.responseModalities !== undefined)
    value.response_modalities = request.responseModalities;
}

function formatInto(value: InteractionsRequest, request: HubRequest): void {
  if (request.responseFormat !== undefined) value.response_format = request.responseFormat;
}

function serviceInto(value: InteractionsRequest, request: HubRequest): void {
  if (request.serviceTier !== undefined) value.service_tier = request.serviceTier;
}

export function interactionsOptionsInto(value: InteractionsRequest, request: HubRequest): void {
  previousInto(value, request);
  reasoningInto(value, request);
  modalitiesInto(value, request);
  formatInto(value, request);
  serviceInto(value, request);
  geminiConfigIntoInteractions(value, request);
}
