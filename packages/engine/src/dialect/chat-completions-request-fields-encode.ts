import type { ChatCompletionsRequestCore, ChatTool, ChatToolChoice } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubRequest, HubSampling, HubTool, HubToolChoice } from './hub';

function chatToolFromHub(tool: HubTool): ChatTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      ...(tool.description !== undefined ? { description: tool.description } : {}),
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties,
        ...(tool.inputSchema.required ? { required: tool.inputSchema.required } : {}),
      },
    },
  };
}

export function chatToolsInto(hub: HubRequest, fates: Fate[]): { tools?: readonly ChatTool[] } {
  if (hub.tools === undefined) {
    return {};
  }

  fates.push({ field: 'tools', disposition: 'carried' });

  return { tools: hub.tools.map(chatToolFromHub) };
}

function basicChatToolChoiceValue(
  choice: Exclude<HubToolChoice, { type: 'web_search' }>,
): ChatToolChoice {
  switch (choice.type) {
    case 'auto':
      return 'auto';
    case 'none':
      return 'none';
    case 'required':
      return 'required';
    case 'tool':
      return { type: 'function', function: { name: choice.name } };

    default: {
      const unknownChoice: never = choice;

      throw new Error(`encodeRequest met an unknown tool choice: ${JSON.stringify(unknownChoice)}`);
    }
  }
}

function chatToolChoiceValue(choice: HubToolChoice): ChatToolChoice {
  return choice.type === 'web_search' ? 'auto' : basicChatToolChoiceValue(choice);
}

export function chatToolChoiceInto(
  hub: HubRequest,
  fates: Fate[],
): { tool_choice?: ChatToolChoice } {
  if (hub.toolChoice === undefined) {
    return {};
  }

  fates.push({ field: 'toolChoice', disposition: 'mapped', to: 'tool_choice' });

  return { tool_choice: chatToolChoiceValue(hub.toolChoice) };
}

function samplingFields(sampling: HubSampling): Partial<ChatCompletionsRequestCore> {
  const fields: Partial<ChatCompletionsRequestCore> = {};

  if (sampling.maxOutputTokens !== undefined) {
    fields.max_tokens = sampling.maxOutputTokens;
  }

  if (sampling.temperature !== undefined) {
    fields.temperature = sampling.temperature;
  }

  if (sampling.topP !== undefined) {
    fields.top_p = sampling.topP;
  }

  if (sampling.stop !== undefined) {
    fields.stop = sampling.stop;
  }

  return fields;
}

export function chatSamplingInto(
  hub: HubRequest,
  fates: Fate[],
): Partial<ChatCompletionsRequestCore> {
  const sampling = hub.sampling;

  if (sampling === undefined) {
    return {};
  }

  fates.push({ field: 'sampling', disposition: 'mapped', to: 'sampling' });

  return samplingFields(sampling);
}
