import type { Translated } from './fates';
import type { GeminiContent, GeminiPart, GeminiRequest } from './gemini-wire';
import type {
  HubContentBlock,
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
} from './hub';

import { geminiReplaySignature } from '../provider/gemini-signature';
import { geminiMediaPart } from './gemini-media';
import { geminiOptionsInto } from './gemini-request-options';

function resultPart(block: Extract<HubContentBlock, { type: 'tool_result' }>): GeminiPart {
  let text = '';

  for (const part of block.content) {
    text += part.type === 'text' ? part.text : '';
  }

  return {
    functionResponse: {
      name: block.toolUseId,
      id: block.toolUseId,
      response: block.isError === true ? { error: text } : { output: text },
    },
  };
}

function textPart(block: HubContentBlock): GeminiPart | null {
  if (block.type === 'text') {
    return { text: block.text };
  }

  if (block.type === 'thinking') {
    return {
      text: block.text,
      thought: true,
      ...(block.signature === undefined ? {} : { thoughtSignature: block.signature }),
    };
  }

  return block.type === 'redacted_thinking'
    ? { text: '', thought: true, thoughtSignature: block.data }
    : null;
}

function actionPart(block: HubContentBlock): GeminiPart | null {
  if (block.type === 'tool_use') {
    return {
      functionCall: { name: block.name, args: { ...block.input }, id: block.id },
      thoughtSignature: geminiReplaySignature(block.signature),
    };
  }

  return block.type === 'tool_result' ? resultPart(block) : null;
}

function partFrom(block: HubContentBlock): GeminiPart {
  return textPart(block) ?? geminiMediaPart(block) ?? actionPart(block) ?? { text: '' };
}

function contentFrom(message: HubMessage): GeminiContent {
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: message.content.map(partFrom),
  };
}

function toolFrom(tool: HubTool) {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters: {
      type: 'object',
      properties: tool.inputSchema.properties,
      ...(tool.inputSchema.required === undefined ? {} : { required: tool.inputSchema.required }),
    },
  };
}

function toolMode(choice: HubToolChoice): 'AUTO' | 'ANY' | 'NONE' {
  return choice.type === 'none' ? 'NONE' : choice.type === 'auto' ? 'AUTO' : 'ANY';
}

function toolConfig(choice: HubToolChoice | undefined): Pick<GeminiRequest, 'toolConfig'> {
  if (choice === undefined || choice.type === 'web_search') {
    return {};
  }

  return {
    toolConfig: {
      functionCallingConfig: {
        mode: toolMode(choice),
        ...(choice.type === 'tool' ? { allowedFunctionNames: [choice.name] } : {}),
      },
    },
  };
}

type GenerationConfig = NonNullable<GeminiRequest['generationConfig']>;

function maxTokensOf(sampling: HubSampling): Pick<GenerationConfig, 'maxOutputTokens'> {
  return sampling.maxOutputTokens === undefined
    ? {}
    : { maxOutputTokens: sampling.maxOutputTokens };
}

function temperatureOf(sampling: HubSampling): Pick<GenerationConfig, 'temperature'> {
  return sampling.temperature === undefined ? {} : { temperature: sampling.temperature };
}

function topPOf(sampling: HubSampling): Pick<GenerationConfig, 'topP'> {
  return sampling.topP === undefined ? {} : { topP: sampling.topP };
}

function stopsOf(sampling: HubSampling): Pick<GenerationConfig, 'stopSequences'> {
  return sampling.stop === undefined ? {} : { stopSequences: sampling.stop };
}

function generationConfig(sampling: HubSampling | undefined): GeminiRequest['generationConfig'] {
  if (sampling === undefined) {
    return undefined;
  }

  const config: GenerationConfig = {
    ...maxTokensOf(sampling),
    ...temperatureOf(sampling),
    ...topPOf(sampling),
    ...stopsOf(sampling),
  };

  return Object.keys(config).length === 0 ? undefined : config;
}

function systemOf(hub: HubRequest): Pick<GeminiRequest, 'systemInstruction'> {
  return hub.system === undefined
    ? {}
    : {
        systemInstruction: {
          role: 'user',
          parts: hub.system.map(({ text }) => ({ text })),
        },
      };
}

function toolsOf(hub: HubRequest): Pick<GeminiRequest, 'tools'> {
  return hub.tools === undefined
    ? {}
    : { tools: [{ functionDeclarations: hub.tools.map(toolFrom) }] };
}

export function encodeRequest(hub: HubRequest): Translated<GeminiRequest> {
  const config = generationConfig(hub.sampling);
  const value: GeminiRequest = {
    contents: hub.messages.map(contentFrom),
    ...systemOf(hub),
    ...toolsOf(hub),
    ...toolConfig(hub.toolChoice),
    ...(config === undefined ? {} : { generationConfig: config }),
  };

  geminiOptionsInto(value, hub);

  return { value, fates: [] };
}
