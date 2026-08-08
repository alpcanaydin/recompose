import { describe, expect, test } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { xaiProviderBody } from './xai-request';
import { filterXAIInternalSearchResponse } from './xai-search-response';
import { collectXAIClientTools } from './xai-tool-ownership';

describe('xAI injected search configuration', () => {
  test('TestXAIExecutorPrepareHonorsInjectXSearchConfig', () => {
    const enabled = xaiProviderBody({ input: 'search' }, crossing({ xaiInjectSearch: true }));
    const disabled = xaiProviderBody({ input: 'search' }, crossing());

    expect(enabled).toHaveProperty('tools.0.type', 'x_search');
    expect(disabled['tools']).toBeUndefined();
  });
});

describe('xAI same-name client search tool ownership', () => {
  test('TestXAIExecutorExecuteStreamFiltersToolSearchTool', () => {
    const body = xaiProviderBody(
      { input: 'search', tools: [{ type: 'tool_search' }, { type: 'function', name: 'lookup' }] },
      crossing({ xaiInjectSearch: true }),
    );

    expect(body).toHaveProperty('tools', [
      { type: 'function', name: 'lookup', parameters: { type: 'object', properties: {} } },
      { type: 'x_search' },
    ]);
  });
});

describe('xAI internal search response filtering', () => {
  test('TestXAIExecutorExecuteStreamFiltersInternalXSearchCalls', async () => {
    const events = await filtered(internalTrace());

    expect(JSON.stringify(events)).not.toContain('x_user_search');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'response.output_text.delta', output_index: 0 }),
    );
  });
});

describe('xAI same-name client search responses', () => {
  test('TestXAIExecutorExecuteFiltersInternalXSearchCalls', async () => {
    const events = await filtered([completed([internalCall(), message()])]);

    expect(events[0]).toHaveProperty('response.output', [message()]);
  });

  test('TestXAIInternalXSearchResponseFilterRequiresNativeTool', async () => {
    const response = sse([completed([internalCall()])]);
    const untouched = filterXAIInternalSearchResponse(response, crossing());

    expect(await untouched.text()).toContain('x_user_search');
  });
});

describe('xAI client search tool ownership', () => {
  test('TestXAIIsInternalXSearchCallPreservesClientDeclaredTools', () => {
    const keys = collectXAIClientTools({
      tools: [
        { type: 'function', name: 'x_keyword_search' },
        { type: 'custom', name: 'x_keyword_search' },
        {
          type: 'namespace',
          name: 'acme',
          tools: [{ type: 'function', name: 'x_keyword_search' }],
        },
      ],
    });

    expect(keys).toContain('function\0\0x_keyword_search');
    expect(keys).toContain('function\0acme\0x_keyword_search');
  });

  test('TestXAIInternalXSearchResponseFilterPreservesClientToolsInCompletedOutput', async () => {
    const events = await filtered(
      [completed([internalKeyword(), clientFunction(), namespacedFunction(), message()])],
      ['function\0\0x_keyword_search', 'function\0acme\0x_keyword_search'],
    );

    expect(events[0]).toHaveProperty('response.output', [
      clientFunction(),
      namespacedFunction(),
      message(),
    ]);
  });
});

describe('xAI same-name client search responses', () => {
  test('TestXAIExecutorExecutePreservesClientSameNameToolsWithXSearch', async () => {
    expect(await completedNames([clientFunction(), internalKeyword()])).toEqual([
      'x_keyword_search',
    ]);
  });
});

describe('xAI same-name client search response preservation', () => {
  test('TestXAIExecutorExecuteStreamPreservesClientSameNameToolsWithXSearch', async () => {
    const events = await filtered(
      [doneEvent(0, internalKeyword()), doneEvent(1, clientFunction())],
      ['function\0\0x_keyword_search'],
    );

    expect(JSON.stringify(events)).toContain('call_plain');
    expect(JSON.stringify(events)).not.toContain('xs_call-1');
  });

  test('TestXAIExecutorExecutePreservesNormalizedCustomSameNameToolWithXSearch', async () => {
    expect(await completedNames([internalKeyword(), clientCustomFunction()])).toEqual([
      'x_keyword_search',
    ]);
  });

  test('TestXAIExecutorExecuteStreamPreservesNormalizedCustomSameNameToolWithXSearch', async () => {
    const events = await filtered(
      [doneEvent(0, internalKeyword()), doneEvent(1, clientCustomFunction())],
      ['function\0\0x_keyword_search'],
    );

    expect(JSON.stringify(events)).toContain('call_custom');
    expect(JSON.stringify(events)).not.toContain('xs_call-1');
  });
});

function crossing(overrides: Partial<Crossing> = {}): Crossing {
  return {
    dialect: 'responses',
    raw: {},
    gatewayName: 'Test',
    virtualModel: 'fast',
    providerModel: 'grok-4.3',
    ...overrides,
  };
}

function ownedCrossing(clientTools: readonly string[]): Crossing {
  return crossing({ xaiSearchOwnership: { clientTools } });
}

async function filtered(
  events: readonly JsonObject[],
  clientTools: readonly string[] = [],
): Promise<JsonObject[]> {
  const response = filterXAIInternalSearchResponse(sse(events), ownedCrossing(clientTools));

  return (await response.text()).split('\n').flatMap((line) => {
    if (!line.startsWith('data:')) return [];
    const value = parsedJson(line.slice('data:'.length).trim());

    return isJsonObject(value) ? [value] : [];
  });
}

function sse(events: readonly JsonObject[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function internalCall(): JsonObject {
  return {
    id: 'ctc_1',
    type: 'custom_tool_call',
    call_id: 'xs_call-1',
    name: 'x_user_search',
    input: '{}',
  };
}

function internalKeyword(): JsonObject {
  return {
    id: 'ctc_1',
    type: 'custom_tool_call',
    call_id: 'xs_call-1',
    name: 'x_keyword_search',
    input: '{}',
  };
}

function clientFunction(): JsonObject {
  return {
    id: 'fc_1',
    type: 'function_call',
    call_id: 'call_plain',
    name: 'x_keyword_search',
    arguments: '{}',
  };
}

function clientCustomFunction(): JsonObject {
  return {
    id: 'fc_2',
    type: 'function_call',
    call_id: 'call_custom',
    name: 'x_keyword_search',
    arguments: '{}',
  };
}

function namespacedFunction(): JsonObject {
  return {
    id: 'fc_3',
    type: 'function_call',
    call_id: 'call_ns',
    name: 'x_keyword_search',
    namespace: 'acme',
    arguments: '{}',
  };
}

function message(): JsonObject {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'answer' }],
  };
}

function doneEvent(outputIndex: number, item: JsonObject): JsonObject {
  return { type: 'response.output_item.done', output_index: outputIndex, item };
}

function completed(output: readonly JsonObject[]): JsonObject {
  return { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output } };
}

function internalTrace(): JsonObject[] {
  return [
    { type: 'response.output_item.added', output_index: 0, item: internalCall() },
    {
      type: 'response.custom_tool_call_input.done',
      output_index: 0,
      item_id: 'ctc_1',
      input: '{}',
    },
    doneEvent(0, internalCall()),
    { type: 'response.output_text.delta', output_index: 1, item_id: 'msg_1', delta: 'answer' },
    completed([internalCall(), message()]),
  ];
}

async function completedNames(output: readonly JsonObject[]): Promise<string[]> {
  const events = await filtered(
    [completed([...output, message()])],
    ['function\0\0x_keyword_search'],
  );

  return completedItems(events).flatMap(itemName);
}

function completedItems(events: readonly JsonObject[]): unknown[] {
  const response = events[0]?.['response'];

  return isJsonObject(response) && Array.isArray(response['output']) ? response['output'] : [];
}

function itemName(item: unknown): string[] {
  return isJsonObject(item) && typeof item['name'] === 'string' ? [item['name']] : [];
}
