import type { HubJsonObject, HubToolInput } from './hub';

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  responsesSignatureDirection?: 'next' | 'previous';
  responsesSignatureTarget?: 'text' | 'function' | 'any';
  citations?: readonly HubJsonObject[];
  serverWebSearch?: {
    kind: 'use' | 'result';
    id: string;
    input: HubJsonObject;
  };
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
  fileData?: { mimeType?: string; fileUri: string };
  functionCall?: { name: string; args?: HubToolInput; id?: string; call_id?: string };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
    id?: string;
    call_id?: string;
  };
};

export type GeminiContent = {
  role?: 'user' | 'model' | 'function';
  parts: GeminiPart[];
};

export type GeminiFunctionDeclaration = {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type GeminiGroundingMetadata = {
  webSearchQueries?: string[];
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
  groundingSupports?: {
    segment?: { startIndex?: number; endIndex?: number; text?: string };
    groundingChunkIndices?: number[];
  }[];
};

type GeminiTool = {
  functionDeclarations: GeminiFunctionDeclaration[];
  googleSearch?: {
    includedDomains?: readonly string[];
    enhancedContent: { imageSearch: { maxResultCount: number } };
  };
};

export type GeminiRequest = {
  model?: string;
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig: { mode: 'AUTO' | 'ANY' | 'NONE'; allowedFunctionNames?: string[] };
  };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: readonly string[];
    thinkingConfig?: {
      thinkingLevel?: string;
      thinkingBudget?: number;
      includeThoughts?: boolean;
    };
    responseModalities?: readonly string[];
    responseMimeType?: string;
    responseJsonSchema?: unknown;
    responseSchema?: unknown;
    seed?: number;
    contextWindowCompression?: HubJsonObject;
    candidateCount?: number;
    [key: string]: unknown;
  };
  service_tier?: string;
};

export type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
  prompt_token_count?: number;
  candidates_token_count?: number;
  cached_content_token_count?: number;
  thoughts_token_count?: number;
  total_token_count?: number;
  webSearchRequests?: number;
};

type GeminiCandidate = {
  content?: GeminiContent;
  finishReason?: string;
  finish_reason?: string;
  groundingMetadata?: GeminiGroundingMetadata;
};

export type GeminiResponse = {
  responseId?: string;
  response_id?: string;
  modelVersion?: string;
  model_version?: string;
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
  usage_metadata?: GeminiUsage;
};
