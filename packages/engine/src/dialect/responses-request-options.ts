import type { HubReasoning, HubRequest } from './hub';
import type { ResponsesRequest } from './responses-wire';

function previousOption(
  request: ResponsesRequest,
): Pick<HubRequest, 'previousResponseId'> | object {
  return request.previous_response_id === undefined
    ? {}
    : { previousResponseId: request.previous_response_id };
}

function reasoningOption(request: ResponsesRequest): Pick<HubRequest, 'reasoning'> | object {
  const reasoning = request.reasoning;

  if (reasoning === undefined) return {};

  const value: HubReasoning = {
    ...(reasoning.effort === undefined ? {} : { effort: reasoning.effort }),
    ...(reasoning.summary === undefined ? {} : { summary: reasoning.summary }),
  };

  return Object.keys(value).length === 0 ? {} : { reasoning: value };
}

function modalitiesOption(
  request: ResponsesRequest,
): Pick<HubRequest, 'responseModalities'> | object {
  return request.modalities === undefined ? {} : { responseModalities: request.modalities };
}

function formatOption(request: ResponsesRequest): Pick<HubRequest, 'responseFormat'> | object {
  const format = request.response_format ?? chatFormatFromText(request.text?.format);

  return format === undefined ? {} : { responseFormat: format };
}

function chatFormatFromText(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if (value['type'] !== 'json_schema') return value;

  const { type: _type, ...jsonSchema } = value;

  return { type: 'json_schema', json_schema: jsonSchema };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serviceOption(request: ResponsesRequest): Pick<HubRequest, 'serviceTier'> | object {
  return request.service_tier === undefined ? {} : { serviceTier: request.service_tier };
}

function parallelOption(request: ResponsesRequest): Pick<HubRequest, 'parallelToolCalls'> | object {
  return request.parallel_tool_calls === undefined
    ? {}
    : { parallelToolCalls: request.parallel_tool_calls };
}

export function hubOptionsFromResponses(request: ResponsesRequest): Partial<HubRequest> {
  return {
    ...previousOption(request),
    ...reasoningOption(request),
    ...modalitiesOption(request),
    ...formatOption(request),
    ...serviceOption(request),
    ...parallelOption(request),
  };
}

export function responsesOptionsInto(value: ResponsesRequest, request: HubRequest): void {
  previousInto(value, request);
  reasoningInto(value, request);
  modalitiesInto(value, request);
  formatInto(value, request);
  serviceInto(value, request);
  parallelInto(value, request);
}

function previousInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.previousResponseId !== undefined)
    value.previous_response_id = request.previousResponseId;
}

function reasoningInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.reasoning === undefined) return;

  value.reasoning = {
    ...(request.reasoning.effort === undefined ? {} : { effort: request.reasoning.effort }),
    ...(request.reasoning.summary === undefined ? {} : { summary: request.reasoning.summary }),
  };
}

function modalitiesInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.responseModalities !== undefined) value.modalities = request.responseModalities;
}

function formatInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.responseFormat !== undefined) value.text = { format: request.responseFormat };
}

function serviceInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.serviceTier !== undefined) value.service_tier = request.serviceTier;
}

function parallelInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.parallelToolCalls !== undefined)
    value.parallel_tool_calls = request.parallelToolCalls;
}
