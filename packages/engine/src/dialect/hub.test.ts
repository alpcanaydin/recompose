import { describe, expect, it } from 'vitest';

import type {
  HubBlockDelta,
  HubBlockOpening,
  HubCacheBreakpoint,
  HubContentBlock,
  HubImageSource,
  HubJsonObject,
  HubSampling,
  HubStopReason,
  HubStreamErrorPayload,
  HubStreamEvent,
  HubToolChoice,
  HubToolResultContent,
  HubToolSchema,
} from './hub';

import {
  aHubImageBlock,
  aHubMessage,
  aHubRequest,
  aHubResponse,
  aHubStreamOfAToolCall,
  aHubSystemText,
  aHubTextBlock,
  aHubThinkingBlock,
  aHubTool,
  aHubToolResultBlock,
  aHubToolUseBlock,
  aHubUsage,
} from './hub.testkit';

describe('the hub content blocks compose from their builders', () => {
  it('carries a text block discriminated by its type', () => {
    expect(aHubTextBlock().type).toBe('text');
  });

  it('carries a thinking block that holds text without a fabricated signature', () => {
    const block = aHubThinkingBlock();

    expect(block.type).toBe('thinking');
    expect(block.signature).toBeUndefined();
  });

  it('carries an image block sourced by base64 or url', () => {
    expect(aHubImageBlock().source.type).toBe('base64');
  });

  it('carries a tool_use block with an id, a name, and an input object', () => {
    const block = aHubToolUseBlock();

    expect(block.id).toBe('toolu_weather');
    expect(block.name).toBe('get_weather');
    expect(block.input).toStrictEqual({ city: 'Paris' });
  });

  it('carries a tool_result block referencing the tool_use it answers', () => {
    expect(aHubToolResultBlock().toolUseId).toBe('toolu_weather');
  });
});

describe('the hub request gathers the fields a decoder produces', () => {
  it('holds messages of role user or assistant', () => {
    expect(aHubMessage().role).toBe('user');
  });

  it('names tools whose schema requires an object with properties', () => {
    expect(aHubTool().inputSchema.properties).toStrictEqual({ city: { type: 'string' } });
  });

  it('assembles a request keeping system, tools, and tool choice', () => {
    const request = aHubRequest({
      system: [aHubSystemText()],
      tools: [aHubTool()],
      toolChoice: { type: 'required' },
      sampling: { maxOutputTokens: 1024, temperature: 0.2 },
    });

    expect(request.system).toHaveLength(1);
    expect(request.tools).toHaveLength(1);
    expect(request.toolChoice).toStrictEqual({ type: 'required' });
    expect(request.sampling?.maxOutputTokens).toBe(1024);
  });
});

describe('the hub response reports content, a stop reason, and usage', () => {
  it('answers a canonical stop reason from the superset', () => {
    expect(aHubResponse({ stopReason: 'context_overflow' }).stopReason).toBe('context_overflow');
  });

  it('counts usage across the token kinds it tracks', () => {
    const usage = aHubUsage({ cacheReadTokens: 4, reasoningTokens: 2 });

    expect(usage.cacheReadTokens).toBe(4);
    expect(usage.reasoningTokens).toBe(2);
  });
});

describe('the hub stream carries a tool call in order and ends clean', () => {
  it('opens with a begin, opens a named tool block, deltas its args, and ends on tool_use', () => {
    const stream = aHubStreamOfAToolCall();

    expect(stream.map((event) => event.type)).toStrictEqual([
      'message-begin',
      'block-open',
      'block-delta',
      'block-close',
      'message-end',
    ]);
    expect(stream.at(-1)).toStrictEqual({
      type: 'message-end',
      stopReason: 'tool_use',
      usage: aHubUsage(),
    });
  });

  it('carries a mid-stream failure as a terminal error event, never a throw', () => {
    const failure: HubStreamEvent = {
      type: 'stream-error',
      error: { type: 'overloaded_error', message: 'the upstream is overloaded' },
    };

    expect(failure.error.message).toBe('the upstream is overloaded');
  });
});

describe('the hub event model pins a tool opening to a name and an id at compile time', () => {
  it('accepts a tool opening that carries both a name and an id', () => {
    const opening: HubBlockOpening = { kind: 'tool', id: 'toolu_weather', name: 'get_weather' };

    expect(opening.kind).toBe('tool');
  });

  it('rejects a tool opening that omits the name', () => {
    // @ts-expect-error a tool opening without a name is not a valid hub block open
    const opening: HubBlockOpening = { kind: 'tool', id: 'toolu_weather' };

    expect(opening.kind).toBe('tool');
  });

  it('rejects a tool opening that omits the id', () => {
    // @ts-expect-error a tool opening without an id is not a valid hub block open
    const opening: HubBlockOpening = { kind: 'tool', name: 'get_weather' };

    expect(opening.kind).toBe('tool');
  });

  it('rejects a tool schema that omits its properties field', () => {
    // @ts-expect-error a tool schema is a JSON-schema object that requires a properties field
    const schema: HubToolSchema = { type: 'object' };

    expect(schema.type).toBe('object');
  });
});

describe('the hub public type surface pins every shape a codec folds through', () => {
  it('marks a text block with an ephemeral cache breakpoint', () => {
    const breakpoint: HubCacheBreakpoint = { type: 'ephemeral' };

    expect(aHubTextBlock({ cacheBreakpoint: breakpoint }).cacheBreakpoint).toStrictEqual(
      breakpoint,
    );
  });

  it('holds a tool_use input as an arbitrary json object', () => {
    const input: HubJsonObject = { city: 'Paris', detailed: true };

    expect(input['city']).toBe('Paris');
  });

  it('sources an image from a url as well as from base64', () => {
    const source: HubImageSource = { type: 'url', url: 'https://example.test/cat.png' };

    expect(source.type).toBe('url');
  });

  it('fills a tool_result with text or image content', () => {
    const content: HubToolResultContent = aHubTextBlock({ text: 'sunny, 21C' });

    expect(content.type).toBe('text');
  });

  it('gathers every block kind under one content union', () => {
    const blocks: readonly HubContentBlock[] = [aHubTextBlock(), aHubToolUseBlock()];

    expect(blocks.map((block) => block.type)).toStrictEqual(['text', 'tool_use']);
  });

  it('forces a specific tool by name through the tool choice', () => {
    const choice: HubToolChoice = { type: 'tool', name: 'get_weather' };

    expect(choice.name).toBe('get_weather');
  });

  it('bounds a request through the sampling knobs', () => {
    const sampling: HubSampling = { maxOutputTokens: 256, stop: ['\n\n'] };

    expect(sampling.stop).toStrictEqual(['\n\n']);
  });

  it('answers a paused turn from the stop reason superset', () => {
    const reason: HubStopReason = 'paused';

    expect(reason).toBe('paused');
  });

  it('streams partial tool arguments through a json-args delta', () => {
    const delta: HubBlockDelta = { kind: 'json-args', partialJson: '{"city":' };

    expect(delta.kind).toBe('json-args');
  });

  it('names a type and a message on a stream error payload', () => {
    const payload: HubStreamErrorPayload = { type: 'overloaded_error', message: 'slow down' };

    expect(payload.message).toBe('slow down');
  });
});
