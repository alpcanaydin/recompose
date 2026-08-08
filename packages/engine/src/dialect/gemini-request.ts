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

import { geminiReplaySignature, nativeGeminiSignature } from '../provider/gemini-signature';
import { geminiMediaPart } from './gemini-media';
import { geminiOptionsInto } from './gemini-request-options';
import { mapGeminiToolNames } from './gemini-tool-names';
import { strictProviderToolSchema } from './tool-schema';

export const antigravityWebSearchSystemInstruction =
  'You are a search engine bot. You will be given a query from a user. Your task is to search the web for relevant information that will help the user. You MUST perform a web search. Do not respond or interact with the user, please respond as if they typed the query into a search bar.';

function resultValue(block: Extract<HubContentBlock, { type: 'tool_result' }>): unknown {
  if (block.structuredResult !== undefined) return block.structuredResult;

  const texts = resultTexts(block);

  return block.content.some((part) => part.type !== 'text')
    ? structuredTextResult(texts)
    : plainTextResult(texts);
}

function resultTexts(block: Extract<HubContentBlock, { type: 'tool_result' }>) {
  return block.content.flatMap((part) => (part.type === 'text' ? [{ text: part.text }] : []));
}

function structuredTextResult(texts: readonly { text: string }[]): unknown {
  return texts.length === 1 ? texts[0] : texts;
}

function plainTextResult(texts: readonly { text: string }[]): unknown {
  return texts.length === 1 ? texts[0]?.text : texts;
}

function resultParts(block: Extract<HubContentBlock, { type: 'tool_result' }>): GeminiPart[] {
  const response = {
    functionResponse: {
      name: block.name ?? block.toolUseId,
      id: block.toolUseId,
      response:
        block.isError === true ? { error: resultValue(block) } : { result: resultValue(block) },
    },
  };
  const media = block.content.flatMap((part) => {
    if (part.type === 'text') return [];

    const encoded = geminiMediaPart(part);

    return encoded === null ? [] : [encoded];
  });

  return [response, ...media];
}

function textPart(block: HubContentBlock): GeminiPart | null {
  if (block.type === 'text') return signedTextPart(block.text, block.signature);

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

function signedTextPart(text: string, signature: string | undefined): GeminiPart {
  return { text, ...(signature === undefined ? {} : { thoughtSignature: signature }) };
}

function actionPart(block: HubContentBlock, firstTool: boolean): GeminiPart | null {
  if (block.type === 'tool_use') {
    const signature = nativeGeminiSignature(block.signature);

    return {
      functionCall: { name: block.name, args: block.input ?? {}, id: block.id },
      ...(signature !== null
        ? { thoughtSignature: signature }
        : firstTool
          ? { thoughtSignature: geminiReplaySignature(undefined) }
          : {}),
    };
  }

  return null;
}

function partFrom(block: HubContentBlock, firstTool: boolean): GeminiPart {
  return textPart(block) ?? geminiMediaPart(block) ?? actionPart(block, firstTool) ?? { text: '' };
}

function partsFrom(block: HubContentBlock, firstTool: boolean): GeminiPart[] {
  if (block.type === 'tool_use' && block.input === undefined) return [];

  return block.type === 'tool_result' ? resultParts(block) : [partFrom(block, firstTool)];
}

function contentParts(blocks: HubMessage['content']): GeminiPart[] {
  const parts: GeminiPart[] = [];
  let sawTool = false;

  for (const block of blocks) {
    const firstTool = block.type === 'tool_use' && !sawTool;

    parts.push(...partsFrom(block, firstTool));
    if (block.type === 'tool_use') sawTool = true;
  }

  return parts;
}

function contentFrom(message: HubMessage): GeminiContent {
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: contentParts(message.content),
  };
}

function toolFrom(tool: HubTool) {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters: strictProviderToolSchema(tool.inputSchema),
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
  if (usesNativeWebSearch(hub)) {
    return {
      systemInstruction: {
        role: 'user',
        parts: [{ text: antigravityWebSearchSystemInstruction }],
      },
    };
  }

  const system = hub.system?.filter((part) => !isClaudeBillingHeader(part.text));

  return system === undefined
    ? {}
    : {
        systemInstruction: {
          role: 'user',
          parts: system.map(({ text }) => ({ text })),
        },
      };
}

function isClaudeBillingHeader(text: string): boolean {
  return text.trimStart().startsWith('x-anthropic-billing-header:');
}

function toolsOf(hub: HubRequest): Pick<GeminiRequest, 'tools'> {
  const functions = functionTools(hub);

  if (functions !== undefined) return { tools: functions };

  const search = webSearchTools(hub);

  return search === undefined ? {} : { tools: search };
}

function functionTools(hub: HubRequest): GeminiRequest['tools'] | undefined {
  return hub.tools === undefined || hub.tools.length === 0
    ? undefined
    : [{ functionDeclarations: hub.tools.map(toolFrom) }];
}

function webSearchTools(hub: HubRequest): GeminiRequest['tools'] | undefined {
  const search = usesNativeWebSearch(hub) ? hub.serverTools?.[0] : undefined;

  if (search === undefined) return undefined;

  return [
    {
      functionDeclarations: [],
      googleSearch: googleSearchOf(search),
    },
  ];
}

function googleSearchOf(search: NonNullable<HubRequest['serverTools']>[number]) {
  return {
    ...(search.allowedDomains === undefined ? {} : { includedDomains: search.allowedDomains }),
    enhancedContent: { imageSearch: { maxResultCount: search.maxUses ?? 5 } },
  };
}

function usesNativeWebSearch(hub: HubRequest): boolean {
  if (!hasSingleWebSearchTool(hub)) return false;
  if (hasFunctionTools(hub)) return false;

  return hub.toolChoice?.type !== 'none';
}

function hasSingleWebSearchTool(hub: HubRequest): boolean {
  return hub.serverTools?.length === 1;
}

function hasFunctionTools(hub: HubRequest): boolean {
  return hub.tools !== undefined && hub.tools.length > 0;
}

export function encodeRequest(hub: HubRequest): Translated<GeminiRequest> {
  const mapped = mapGeminiToolNames(hub);
  const config = generationConfig(mapped.sampling);
  const value: GeminiRequest = {
    contents: mapped.messages.map(contentFrom),
    ...systemOf(mapped),
    ...toolsOf(mapped),
    ...toolConfig(mapped.toolChoice),
    ...(config === undefined ? {} : { generationConfig: config }),
  };

  geminiOptionsInto(value, mapped);

  if (usesNativeWebSearch(mapped)) {
    value.generationConfig = { ...value.generationConfig, candidateCount: 1 };
  }

  return { value, fates: [] };
}
