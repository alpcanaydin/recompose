import type { Translated } from './fates';
import type {
  HubJsonObject,
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
} from './hub';
import type {
  InteractionsFunctionTool,
  InteractionsRequest,
  InteractionsStep,
  InteractionsToolChoice,
  InteractionsTurn,
} from './interactions-wire';

import { isJsonObject } from '../gateway-wire';
import { mergeAdjacentSameRole, parseToolArguments } from './hub-build';
import { hubBlocksFromInteractionsContent, interactionsText } from './interactions-content';

function callInput(value: HubJsonObject | string): HubJsonObject {
  return typeof value === 'string' ? parseToolArguments(value) : value;
}

function resultText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isJsonObject(value) && typeof value['output'] === 'string') return value['output'];

  return JSON.stringify(value);
}

function stepMessage(step: InteractionsStep): HubMessage {
  if (step.type === 'user_input') {
    return { role: 'user', content: hubBlocksFromInteractionsContent(step.content) };
  }

  if (step.type === 'model_output') {
    return { role: 'assistant', content: hubBlocksFromInteractionsContent(step.content) };
  }

  if (step.type === 'thought') return thoughtMessage(step);
  if (step.type === 'function_call') return functionCallMessage(step);

  return functionResultMessage(step);
}

function thoughtMessage(step: Extract<InteractionsStep, { type: 'thought' }>): HubMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        text: interactionsText(step.content),
        ...(step.signature === undefined ? {} : { signature: step.signature }),
      },
    ],
  };
}

function functionCallMessage(
  step: Extract<InteractionsStep, { type: 'function_call' }>,
): HubMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: step.call_id ?? step.id ?? step.name,
        name: step.name,
        input: callInput(step.arguments),
        ...(step.signature === undefined ? {} : { signature: step.signature }),
      },
    ],
  };
}

function functionResultMessage(
  step: Extract<InteractionsStep, { type: 'function_result' }>,
): HubMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        toolUseId: step.call_id,
        content: [{ type: 'text', text: resultText(step.result) }],
      },
    ],
  };
}

function isTurn(value: InteractionsStep | InteractionsTurn): value is InteractionsTurn {
  return 'role' in value;
}

function turnMessages(turn: InteractionsTurn): HubMessage[] {
  if (turn.steps !== undefined) return turn.steps.map(stepMessage);

  const role = turn.role === 'user' ? 'user' : 'assistant';

  return [{ role, content: hubBlocksFromInteractionsContent(turn.parts ?? []) }];
}

function inputMessages(input: InteractionsRequest['input']): HubMessage[] {
  if (typeof input === 'string')
    return [{ role: 'user', content: [{ type: 'text', text: input }] }];

  const items = inputArray(input) ? input : [input];

  const messages = items.flatMap((item) =>
    isTurn(item) ? turnMessages(item) : [stepMessage(item)],
  );

  return mergeAdjacentSameRole(messages);
}

function inputArray(
  value: Exclude<InteractionsRequest['input'], string>,
): value is readonly (InteractionsStep | InteractionsTurn)[] {
  return Array.isArray(value);
}

function toolProperties(tool: InteractionsFunctionTool): HubJsonObject {
  const properties = tool.parameters?.['properties'];

  return isJsonObject(properties) ? properties : {};
}

function requiredProperties(tool: InteractionsFunctionTool): readonly string[] | undefined {
  const required = tool.parameters?.['required'];

  return Array.isArray(required)
    ? required.filter((value): value is string => typeof value === 'string')
    : undefined;
}

function toolOf(tool: InteractionsFunctionTool): HubTool {
  const required = requiredProperties(tool);

  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: {
      type: 'object',
      properties: toolProperties(tool),
      ...(required === undefined ? {} : { required }),
    },
  };
}

function toolChoiceOf(choice: InteractionsToolChoice): HubToolChoice {
  if (typeof choice === 'object') return { type: 'tool', name: choice.name };

  return { type: choice };
}

function samplingOf(request: InteractionsRequest): HubSampling | undefined {
  const config = request.generation_config;

  if (config === undefined) return undefined;

  const sampling: HubSampling = {};

  applyMaxTokens(sampling, config.max_output_tokens);
  applyTemperature(sampling, config.temperature);
  applyTopP(sampling, config.top_p);
  applyStops(sampling, config.stop_sequences);

  return Object.keys(sampling).length === 0 ? undefined : sampling;
}

function applyMaxTokens(sampling: HubSampling, value: number | undefined): void {
  if (value !== undefined) sampling.maxOutputTokens = value;
}

function applyTemperature(sampling: HubSampling, value: number | undefined): void {
  if (value !== undefined) sampling.temperature = value;
}

function applyTopP(sampling: HubSampling, value: number | undefined): void {
  if (value !== undefined) sampling.topP = value;
}

function applyStops(sampling: HubSampling, value: readonly string[] | undefined): void {
  if (value !== undefined) sampling.stop = value;
}

function optionalSystem(request: InteractionsRequest): Pick<HubRequest, 'system'> | object {
  return request.system_instruction === undefined
    ? {}
    : { system: [{ text: request.system_instruction }] };
}

function optionalTools(request: InteractionsRequest): Pick<HubRequest, 'tools'> | object {
  return request.tools === undefined ? {} : { tools: request.tools.map(toolOf) };
}

function optionalChoice(request: InteractionsRequest): Pick<HubRequest, 'toolChoice'> | object {
  const choice = request.generation_config?.tool_choice;

  return choice === undefined ? {} : { toolChoice: toolChoiceOf(choice) };
}

function optionalSampling(request: InteractionsRequest): Pick<HubRequest, 'sampling'> | object {
  const sampling = samplingOf(request);

  return sampling === undefined ? {} : { sampling };
}

export function decodeRequest(request: InteractionsRequest): Translated<HubRequest> {
  return {
    value: {
      messages: inputMessages(request.input),
      ...optionalSystem(request),
      ...optionalTools(request),
      ...optionalChoice(request),
      ...optionalSampling(request),
    },
    fates: [],
  };
}
