import type { Translated } from './fates';
import type {
  HubJsonObject,
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
  HubToolInput,
} from './hub';
import type {
  InteractionsFunctionTool,
  InteractionsRequest,
  InteractionsStep,
  InteractionsToolChoice,
  InteractionsTool,
  InteractionsTurn,
} from './interactions-wire';

import { parseToolArguments } from './hub-build';
import { hubBlocksFromInteractionsContent, interactionsText } from './interactions-content';
import { hubOptionsFromInteractions } from './interactions-request-options';
import { hubToolSchemaFrom } from './tool-schema';

function isJsonObject(value: unknown): value is HubJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function callInput(value: HubToolInput): HubToolInput {
  return typeof value === 'string' ? parseToolArguments(value) : value;
}

function normalizedName(value: unknown): string {
  return String(value);
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
  const media = hubBlocksFromInteractionsContent(step.content ?? []).filter(
    (block) => block.type !== 'text',
  );

  return {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        text: interactionsText(step.content),
        ...(step.signature === undefined ? {} : { signature: step.signature }),
      },
      ...media,
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
        name: normalizedName(step.name),
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
        ...(step.name === undefined ? {} : { name: normalizedName(step.name) }),
        content: [{ type: 'text', text: resultText(step.result) }],
        structuredResult: step.result,
      },
    ],
  };
}

function isTurn(value: InteractionsStep | InteractionsTurn): value is InteractionsTurn {
  return 'role' in value;
}

function turnMessages(turn: InteractionsTurn): HubMessage[] {
  if (turn.steps !== undefined) {
    const messages = turn.steps.map(stepMessage);

    return turn.role === 'user'
      ? messages
      : messages.map((message) => ({ ...message, role: 'assistant' }));
  }

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

  return messages;
}

function inputArray(
  value: Exclude<InteractionsRequest['input'], string>,
): value is readonly (InteractionsStep | InteractionsTurn)[] {
  return Array.isArray(value);
}

function toolOf(tool: InteractionsFunctionTool): HubTool {
  return {
    name: normalizedName(tool.name),
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: hubToolSchemaFrom(tool.parameters),
  };
}

function toolChoiceOf(choice: InteractionsToolChoice): HubToolChoice {
  if (typeof choice === 'object') {
    return {
      type: 'tool',
      name: normalizedName('function' in choice ? choice.function.name : choice.name),
    };
  }

  return { type: choice };
}

function functionTools(tools: readonly InteractionsTool[]): InteractionsFunctionTool[] {
  return tools.flatMap((tool) => {
    if ('type' in tool) return [tool];

    const declarations = tool.functionDeclarations ?? tool.function_declarations ?? [];

    return declarations.map((declaration) => ({ type: 'function', ...declaration }));
  });
}

function uniqueTools(tools: readonly InteractionsFunctionTool[]): InteractionsFunctionTool[] {
  const names = new Set<string>();

  return tools.filter((tool) => {
    const name = normalizedName(tool.name);

    if (names.has(name)) return false;

    names.add(name);

    return true;
  });
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
  const instruction = request.system_instruction;

  if (instruction === undefined) return {};
  if (typeof instruction === 'string') return { system: [{ text: instruction }] };

  const text = instruction.text ?? interactionsText(instruction.parts);

  return text === '' ? {} : { system: [{ text }] };
}

function optionalTools(request: InteractionsRequest): Pick<HubRequest, 'tools'> | object {
  return request.tools === undefined
    ? {}
    : { tools: uniqueTools(functionTools(request.tools)).map(toolOf) };
}

function optionalChoice(request: InteractionsRequest): Pick<HubRequest, 'toolChoice'> | object {
  const choice = request.generation_config?.tool_choice ?? request.tool_choice;

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
      ...hubOptionsFromInteractions(request),
      ...optionalSystem(request),
      ...optionalTools(request),
      ...optionalChoice(request),
      ...optionalSampling(request),
    },
    fates: [],
  };
}
