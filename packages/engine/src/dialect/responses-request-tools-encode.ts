import type { HubTool, HubToolChoice, HubWebSearchTool } from './hub';
import type { ResponsesTool, ResponsesToolChoice, ResponsesToolParameters } from './responses-wire';

import { customResponsesChoice, customResponsesTool } from './responses-custom-tool-encode';
import { responsesIdentifier } from './tool-id';
import { strictProviderToolSchema } from './tool-schema';

export function toResponsesTool(tool: HubTool): ResponsesTool {
  if (tool.family === 'custom') return customResponsesTool(tool);
  const parameters: ResponsesToolParameters = strictProviderToolSchema(tool.inputSchema);

  return {
    type: 'function',
    name: responsesIdentifier(tool.name),
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters,
  };
}

export function toResponsesWebSearchTool(tool: HubWebSearchTool): ResponsesTool {
  return {
    type: 'web_search',
    ...(tool.allowedDomains === undefined
      ? {}
      : { filters: { allowed_domains: tool.allowedDomains } }),
    ...(tool.userLocation === undefined ? {} : { user_location: tool.userLocation }),
  };
}

function namedChoice(choice: Extract<HubToolChoice, { type: 'tool' }>): ResponsesToolChoice {
  if (choice.family === 'custom') return customResponsesChoice(choice);

  return { type: 'function', name: responsesIdentifier(choice.name) };
}

export function toResponsesToolChoice(choice: HubToolChoice): ResponsesToolChoice {
  if (choice.type === 'web_search') return { type: 'web_search' };
  if (choice.type === 'tool') return namedChoice(choice);
  if (choice.type === 'auto') return 'auto';
  if (choice.type === 'none') return 'none';

  return 'required';
}
