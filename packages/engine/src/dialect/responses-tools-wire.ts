import type { HubJsonObject } from './hub';

export type ResponsesToolParameters = {
  readonly [key: string]: unknown;
  type?: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
  anyOf?: readonly unknown[];
  oneOf?: readonly unknown[];
};

export type ResponsesFunctionTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters: ResponsesToolParameters;
  strict?: boolean;
};

export type ResponsesCustomTool = {
  type: 'custom';
  name: string;
  description?: string;
  format?: unknown;
};

export type ResponsesNamespaceTool = {
  type: 'namespace';
  name: string;
  description?: string;
  tools: readonly ResponsesTool[];
};

type ResponsesWebSearchTool = {
  type: 'web_search';
  filters?: { allowed_domains: readonly string[] };
  user_location?: HubJsonObject;
};

export type ResponsesTool =
  | ResponsesFunctionTool
  | ResponsesCustomTool
  | ResponsesNamespaceTool
  | ResponsesWebSearchTool;

export type ResponsesToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string }
  | { type: 'function'; function: { name: string } }
  | { type: 'function'; name: string; namespace: string }
  | { type: 'custom'; name: string }
  | { type: 'web_search' };

export function responsesToolChoiceName(
  choice: Exclude<ResponsesToolChoice, string | { type: 'web_search' }>,
): string {
  return 'function' in choice ? choice.function.name : choice.name;
}
