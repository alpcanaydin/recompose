import { expect, test } from 'vitest';

import { restoreXAIToolResponse } from './xai-tool-response';

test('restores flattened xAI namespace calls in item and completed events', async () => {
  const events = [
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'function_call',
        name: 'mcp__exa__web_search_exa',
        call_id: 'call_1',
        arguments: '{}',
      },
    },
    {
      type: 'response.completed',
      response: {
        output: [
          {
            type: 'function_call',
            name: 'mcp__exa__web_search_exa',
            call_id: 'call_1',
            arguments: '{}',
          },
        ],
      },
    },
  ];
  const response = new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  );
  const restored = restoreXAIToolResponse(response, {
    mcp__exa__web_search_exa: { namespace: 'mcp__exa', name: 'web_search_exa' },
  });
  const text = await restored.text();

  expect(text).toContain('"name":"web_search_exa"');
  expect(text).toContain('"namespace":"mcp__exa"');
  expect(text).not.toContain('"name":"mcp__exa__web_search_exa"');
});

test('leaves unmapped calls, sentinel lines, and carriage returns as they arrived', async () => {
  const call = { type: 'function_call', name: 'read_file', call_id: 'call_9', arguments: '{}' };
  const response = new Response(`data: ${JSON.stringify(call)}\r\n\r\ndata: [DONE]\r\n\r\n`);

  const restored = restoreXAIToolResponse(response, {
    mcp__exa__web_search_exa: { namespace: 'mcp__exa', name: 'web_search_exa' },
  });
  const text = await restored.text();

  expect(text).toContain('"name":"read_file"');
  expect(text).not.toContain('"namespace"');
  expect(text).toContain('data: [DONE]');
});
