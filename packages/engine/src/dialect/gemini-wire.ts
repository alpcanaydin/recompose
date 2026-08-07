import type { HubJsonObject } from './hub';

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType?: string; fileUri: string };
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
};

export type GeminiContent = {
  role?: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiFunctionDeclaration = {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type GeminiRequest = {
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
  tools?: { functionDeclarations: GeminiFunctionDeclaration[] }[];
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
};

type GeminiCandidate = {
  content?: GeminiContent;
  finishReason?: string;
};

export type GeminiResponse = {
  responseId?: string;
  modelVersion?: string;
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
};
