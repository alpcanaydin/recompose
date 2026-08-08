import { describe, expect, it } from 'vitest';

import {
  restoreClaudeToolBody,
  restoreClaudeToolResponse,
  restoreClaudeToolSseLine,
} from './claude-tool-response';

const renamed = { mcp__github__list: 'list_issues' };

async function bodyOf(response: Response): Promise<string> {
  return response.text();
}

describe('Restoring renamed tools in a Claude answer body', () => {
  it('should restore the caller name of a tool the upstream renamed', () => {
    const restored = restoreClaudeToolBody(
      { content: [{ type: 'tool_use', name: 'mcp__github__list' }] },
      renamed,
    );

    expect(restored).toEqual({ content: [{ type: 'tool_use', name: 'list_issues' }] });
  });

  it('should restore the caller name carried by a tool reference', () => {
    const restored = restoreClaudeToolBody(
      { content: [{ type: 'tool_reference', tool_name: 'mcp__github__list' }] },
      renamed,
    );

    expect(restored).toEqual({ content: [{ type: 'tool_reference', tool_name: 'list_issues' }] });
  });

  it('should leave a tool the rename map never covered alone', () => {
    const restored = restoreClaudeToolBody(
      { content: [{ type: 'tool_use', name: 'bash' }] },
      renamed,
    );

    expect(restored).toEqual({ content: [{ type: 'tool_use', name: 'bash' }] });
  });

  it('should leave a tool whose name is not text alone', () => {
    const restored = restoreClaudeToolBody({ content: [{ type: 'tool_use', name: 7 }] }, renamed);

    expect(restored).toEqual({ content: [{ type: 'tool_use', name: 7 }] });
  });
});

describe('Restoring renamed tools nested inside a Claude tool result', () => {
  it('should restore a tool reference nested inside a tool result', () => {
    const restored = restoreClaudeToolBody(
      {
        content: [
          {
            type: 'tool_result',
            content: [{ type: 'tool_reference', tool_name: 'mcp__github__list' }, 'raw'],
          },
        ],
      },
      renamed,
    );

    expect(restored).toHaveProperty('content.0.content.0.tool_name', 'list_issues');
  });

  it('should leave a tool result whose content is not a list alone', () => {
    const restored = restoreClaudeToolBody(
      { content: [{ type: 'tool_result', content: 'sunny' }] },
      renamed,
    );

    expect(restored).toEqual({ content: [{ type: 'tool_result', content: 'sunny' }] });
  });

  it('should leave a nested block that names no tool alone', () => {
    const restored = restoreClaudeToolBody(
      { content: [{ type: 'tool_result', content: [{ type: 'text', text: 'sunny' }] }] },
      renamed,
    );

    expect(restored).toHaveProperty('content.0.content.0.text', 'sunny');
  });

  it('should leave a body whose content is not a list alone', () => {
    expect(restoreClaudeToolBody({ content: 'sunny' }, renamed)).toEqual({ content: 'sunny' });
  });

  it('should leave a content entry that is not a block alone', () => {
    expect(restoreClaudeToolBody({ content: ['raw'] }, renamed)).toEqual({ content: ['raw'] });
  });
});

describe('Restoring renamed tools in a Claude stream line', () => {
  it('should restore the tool name inside a spaced data line', () => {
    const line = restoreClaudeToolSseLine(
      'data: {"content_block":{"type":"tool_use","name":"mcp__github__list"}}',
      renamed,
    );

    expect(line).toBe('data: {"content_block":{"type":"tool_use","name":"list_issues"}}');
  });

  it('should restore the tool name inside an unspaced data line', () => {
    const line = restoreClaudeToolSseLine(
      'data:{"content_block":{"type":"tool_use","name":"mcp__github__list"}}',
      renamed,
    );

    expect(line).toBe('data:{"content_block":{"type":"tool_use","name":"list_issues"}}');
  });

  it('should pass an event line through untouched', () => {
    expect(restoreClaudeToolSseLine('event: content_block_start', renamed)).toBe(
      'event: content_block_start',
    );
  });

  it('should pass a data line that is not JSON through untouched', () => {
    expect(restoreClaudeToolSseLine('data: [DONE]', renamed)).toBe('data: [DONE]');
  });

  it('should pass a data line that opens no content block through untouched', () => {
    expect(restoreClaudeToolSseLine('data: {"type":"ping"}', renamed)).toBe(
      'data: {"type":"ping"}',
    );
  });

  it('should pass a content block that names no tool through untouched', () => {
    const line = 'data: {"content_block":{"type":"text","text":"hi"}}';

    expect(restoreClaudeToolSseLine(line, renamed)).toBe(line);
  });
});

describe('Restoring renamed tools across a Claude response', () => {
  it('should return the upstream response when no tool was renamed', async () => {
    const response = new Response('{"content":[]}');

    await expect(restoreClaudeToolResponse(response, {})).resolves.toBe(response);
  });

  it('should return the upstream response when it carries no body', async () => {
    const response = new Response(null, { status: 204 });

    await expect(restoreClaudeToolResponse(response, renamed)).resolves.toBe(response);
  });

  it('should restore the tool name in a whole JSON answer', async () => {
    const response = new Response(
      JSON.stringify({ content: [{ type: 'tool_use', name: 'mcp__github__list' }] }),
      { headers: { 'content-type': 'application/json', 'content-length': '58' } },
    );

    const restored = await restoreClaudeToolResponse(response, renamed);

    await expect(bodyOf(restored)).resolves.toBe(
      '{"content":[{"type":"tool_use","name":"list_issues"}]}',
    );
  });
});

describe('Preserving the Claude response envelope while restoring', () => {
  it('should drop the stale content length after rewriting the answer', async () => {
    const response = new Response(JSON.stringify({ content: [] }), {
      headers: { 'content-type': 'application/json', 'content-length': '16' },
    });

    const restored = await restoreClaudeToolResponse(response, renamed);

    expect(restored.headers.get('content-length')).toBeNull();
  });

  it('should pass a JSON answer that is not an object through unchanged', async () => {
    const response = new Response('"plain"', {
      headers: { 'content-type': 'application/json' },
    });

    await expect(bodyOf(await restoreClaudeToolResponse(response, renamed))).resolves.toBe(
      '"plain"',
    );
  });

  it('should restore the tool name in a streamed answer', async () => {
    const response = new Response(
      'event: content_block_start\ndata: {"content_block":{"type":"tool_use","name":"mcp__github__list"}}\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );

    const restored = await restoreClaudeToolResponse(response, renamed);

    await expect(bodyOf(restored)).resolves.toContain('"name":"list_issues"');
  });

  it('should keep the upstream status while restoring the answer', async () => {
    const response = new Response(JSON.stringify({ content: [] }), {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
    });

    const restored = await restoreClaudeToolResponse(response, renamed);

    expect(restored.status).toBe(201);
  });
});
