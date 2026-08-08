import type { Translated } from './fates';
import type {
  HubContentBlock,
  HubJsonObject,
  HubMessage,
  HubRequest,
  HubTool,
  HubToolChoice,
  HubToolResultBlock,
} from './hub';
import type {
  InteractionsContentPart,
  InteractionsFunctionTool,
  InteractionsGenerationConfig,
  InteractionsRequest,
  InteractionsStep,
  InteractionsToolChoice,
} from './interactions-wire';

import {
  interactionsImagePart,
  interactionsPartFromHubMedia,
  interactionsToolCall,
  isHubInteractionsMedia,
} from './interactions-content';
import { interactionsOptionsInto } from './interactions-request-options';
import { strictProviderToolSchema } from './tool-schema';

function contentPart(block: HubContentBlock): InteractionsContentPart | null {
  if (block.type === 'text') return { type: 'text', text: block.text };

  return isHubInteractionsMedia(block) ? interactionsPartFromHubMedia(block) : null;
}

function resultValue(block: HubToolResultBlock): unknown {
  if (block.structuredResult !== undefined) return block.structuredResult;

  const content = block.content.map((part) =>
    part.type === 'text' ? { type: 'text', text: part.text } : interactionsImagePart(part.source),
  );

  return content.length === 1 && content[0]?.type === 'text' ? content[0].text : content;
}

function actionStep(block: HubContentBlock): InteractionsStep | null {
  if (block.type === 'tool_use') {
    return interactionsToolCall(block);
  }

  if (block.type !== 'tool_result') return null;

  return {
    type: 'function_result',
    call_id: block.toolUseId,
    ...(block.name === undefined ? {} : { name: block.name }),
    result: resultValue(block),
  };
}

function reasoningStep(block: HubContentBlock): InteractionsStep | null {
  if (block.type === 'thinking') {
    return {
      type: 'thought',
      content: [{ type: 'text', text: block.text }],
      ...(block.signature === undefined ? {} : { signature: block.signature }),
    };
  }

  if (block.type !== 'redacted_thinking') return null;

  return { type: 'thought', content: [], signature: block.data };
}

function contentStep(
  role: HubMessage['role'],
  content: readonly InteractionsContentPart[],
): InteractionsStep {
  return { type: role === 'user' ? 'user_input' : 'model_output', content };
}

function stepsOfMessage(message: HubMessage): InteractionsStep[] {
  const steps: InteractionsStep[] = [];
  let content: InteractionsContentPart[] = [];

  const flush = (): void => {
    if (content.length > 0) steps.push(contentStep(message.role, content));
    content = [];
  };

  for (const block of message.content) {
    const part = contentPart(block);

    if (part !== null) {
      content.push(part);
    } else {
      flush();

      const step = reasoningStep(block) ?? actionStep(block);

      if (step !== null) steps.push(step);
    }
  }

  flush();

  return steps;
}

function inputOf(messages: readonly HubMessage[]): InteractionsStep[] {
  return messages.flatMap(stepsOfMessage);
}

function toolOf(tool: HubTool): InteractionsFunctionTool {
  return {
    type: 'function',
    name: tool.name,
    parameters: toolParameters(tool),
    ...toolDescription(tool),
  };
}

function toolParameters(tool: HubTool): HubJsonObject {
  return strictProviderToolSchema(tool.inputSchema);
}

function toolDescription(tool: HubTool): Pick<InteractionsFunctionTool, 'description'> | object {
  return tool.description === undefined ? {} : { description: tool.description };
}

function toolChoiceOf(choice: HubToolChoice): InteractionsToolChoice | undefined {
  if (choice.type === 'web_search') return undefined;
  if (choice.type === 'tool') return { type: 'function', name: choice.name };

  return choice.type;
}

function generationConfig(request: HubRequest): InteractionsGenerationConfig | undefined {
  const config = samplingConfig(request);

  applyToolChoice(config, request.toolChoice);

  return Object.keys(config).length === 0 ? undefined : config;
}

function samplingConfig(request: HubRequest): InteractionsGenerationConfig {
  const config: InteractionsGenerationConfig = {};
  const sampling = request.sampling;

  if (sampling === undefined) return config;

  applyMaxTokens(config, sampling.maxOutputTokens);
  applyTemperature(config, sampling.temperature);
  applyTopP(config, sampling.topP);
  applyStops(config, sampling.stop);

  return config;
}

function applyMaxTokens(config: InteractionsGenerationConfig, value: number | undefined): void {
  if (value !== undefined) config.max_output_tokens = value;
}

function applyTemperature(config: InteractionsGenerationConfig, value: number | undefined): void {
  if (value !== undefined) config.temperature = value;
}

function applyTopP(config: InteractionsGenerationConfig, value: number | undefined): void {
  if (value !== undefined) config.top_p = value;
}

function applyStops(
  config: InteractionsGenerationConfig,
  value: readonly string[] | undefined,
): void {
  if (value !== undefined) config.stop_sequences = value;
}

function applyToolChoice(
  config: InteractionsGenerationConfig,
  value: HubToolChoice | undefined,
): void {
  const choice = value === undefined ? undefined : toolChoiceOf(value);

  if (choice !== undefined) config.tool_choice = choice;
}

function systemInstruction(request: HubRequest): string | undefined {
  const text = request.system?.map((part) => part.text).join('\n');

  return text === '' ? undefined : text;
}

export function encodeRequest(request: HubRequest): Translated<InteractionsRequest> {
  const system = systemInstruction(request);
  const config = generationConfig(request);

  const value: InteractionsRequest = {
    input: inputOf(request.messages),
    ...(system === undefined ? {} : { system_instruction: system }),
    ...(request.tools === undefined ? {} : { tools: request.tools.map(toolOf) }),
    ...(config === undefined ? {} : { generation_config: config }),
  };

  interactionsOptionsInto(value, request);

  return { value, fates: [] };
}
