import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatCompletionsResponse,
  ChatDeveloperMessage,
  ChatStreamFrame,
  ChatSystemMessage,
  ChatTool,
  ChatToolCall,
  ChatToolMessage,
  ChatUserMessage,
} from './chat-completions-wire';

export function aChatToolCall(overrides: Partial<ChatToolCall> = {}): ChatToolCall {
  return {
    id: 'call_weather',
    type: 'function',
    function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
    ...overrides,
  };
}

export function aChatSystemMessage(overrides: Partial<ChatSystemMessage> = {}): ChatSystemMessage {
  return { role: 'system', content: 'You answer concisely.', ...overrides };
}

export function aChatDeveloperMessage(
  overrides: Partial<ChatDeveloperMessage> = {},
): ChatDeveloperMessage {
  return { role: 'developer', content: 'Answer in English.', ...overrides };
}

export function aChatUserMessage(overrides: Partial<ChatUserMessage> = {}): ChatUserMessage {
  return { role: 'user', content: 'What is the weather in Paris?', ...overrides };
}

export function aChatAssistantMessage(
  overrides: Partial<ChatAssistantMessage> = {},
): ChatAssistantMessage {
  return { role: 'assistant', content: null, tool_calls: [aChatToolCall()], ...overrides };
}

export function aChatToolMessage(overrides: Partial<ChatToolMessage> = {}): ChatToolMessage {
  return { role: 'tool', tool_call_id: 'call_weather', content: 'sunny, 21C', ...overrides };
}

export function aChatTool(overrides: Partial<ChatTool> = {}): ChatTool {
  return {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Look up the weather for a city',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
    },
    ...overrides,
  };
}

export function aChatRequest(
  overrides: Partial<ChatCompletionsRequest> = {},
): ChatCompletionsRequest {
  return { model: 'gpt-5', messages: [aChatUserMessage()], ...overrides };
}

export function aChatResponse(
  overrides: Partial<ChatCompletionsResponse> = {},
): ChatCompletionsResponse {
  return {
    choices: [
      { index: 0, message: { role: 'assistant', content: 'Sunny, 21C.' }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 8 },
    ...overrides,
  };
}

export function aChatToolCallChunkStream(): readonly ChatStreamFrame[] {
  return [
    {
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              tool_calls: [
                { index: 0, id: 'call_weather', function: { name: 'get_weather', arguments: '' } },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":"Paris"}' } }] },
          },
        ],
      },
    },
    { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] } },
    { type: 'chunk', chunk: { choices: [], usage: { prompt_tokens: 12, completion_tokens: 5 } } },
    { type: 'done' },
  ];
}

export function aChatTextThenToolStream(): readonly ChatStreamFrame[] {
  return [
    {
      type: 'chunk',
      chunk: { choices: [{ index: 0, delta: { role: 'assistant', content: 'Let me check. ' } }] },
    },
    {
      type: 'chunk',
      chunk: {
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_weather',
                  function: { name: 'get_weather', arguments: '{}' },
                },
              ],
            },
          },
        ],
      },
    },
    { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] } },
    { type: 'done' },
  ];
}

export async function* streamOf<T>(frames: readonly T[]): AsyncIterable<T> {
  await Promise.resolve();

  for (const frame of frames) {
    yield frame;
  }
}

export async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];

  for await (const item of source) {
    collected.push(item);
  }

  return collected;
}
