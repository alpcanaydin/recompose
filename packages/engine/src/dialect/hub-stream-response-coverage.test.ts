import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';

import { collectHubResponse } from './hub-stream-response';

async function* streamOf(events: readonly HubStreamEvent[]): AsyncIterable<HubStreamEvent> {
  for (const event of events) yield await Promise.resolve(event);
}

function ending(): HubStreamEvent {
  return { type: 'message-end', stopReason: 'end', usage: { outputTokens: 3 } };
}

describe('Folding a hub stream into a response', () => {
  it('should return no response when the stream never ends the message', async () => {
    const collected = await collectHubResponse(
      streamOf([{ type: 'message-begin', id: 'msg_1', model: 'sonnet' }]),
    );

    expect(collected).toBeNull();
  });

  it('should carry the identity announced at the start of the message', async () => {
    const collected = await collectHubResponse(
      streamOf([{ type: 'message-begin', id: 'msg_1', model: 'sonnet' }, ending()]),
    );

    expect(collected).toEqual({
      id: 'msg_1',
      model: 'sonnet',
      content: [],
      stopReason: 'end',
      usage: { outputTokens: 3 },
    });
  });

  it('should omit an identity the stream never announced', async () => {
    const collected = await collectHubResponse(streamOf([ending()]));

    expect(collected).toEqual({ content: [], stopReason: 'end', usage: { outputTokens: 3 } });
  });

  it('should stop at a stream error and return no response', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'stream-error', error: { type: 'overloaded_error', message: 'upstream busy' } },
        ending(),
      ]),
    );

    expect(collected).toBeNull();
  });
});

describe('Folding hub text blocks', () => {
  it('should join the text deltas of a closed block', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'text' } },
        { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'Hel' } },
        { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'lo' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [{ type: 'text', text: 'Hello' }]);
  });

  it('should drop a block the stream opened but never closed', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'text' } },
        { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'partial' } },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', []);
  });

  it('should ignore an annotation delta that carries no block content', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'text' } },
        { type: 'block-delta', index: 0, delta: { kind: 'annotation', annotation: { url: 'a' } } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [{ type: 'text', text: '' }]);
  });
});

describe('Folding hub events that address no block', () => {
  it('should ignore a delta addressed to an index no block occupies', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-delta', index: 7, delta: { kind: 'text', text: 'orphan' } },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', []);
  });

  it('should ignore a close addressed to an index no block occupies', async () => {
    const collected = await collectHubResponse(
      streamOf([{ type: 'block-close', index: 7 }, ending()]),
    );

    expect(collected).toHaveProperty('content', []);
  });
});

describe('Folding hub thinking blocks', () => {
  it('should attach the signature the stream delivered as a delta', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
        { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weighing' } },
        { type: 'block-delta', index: 0, delta: { kind: 'signature', signature: 'sig-1' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [
      { type: 'thinking', text: 'weighing', signature: 'sig-1' },
    ]);
  });

  it('should leave an unsigned thinking block without a signature', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'thinking' } },
        { type: 'block-delta', index: 0, delta: { kind: 'thinking', text: 'weighing' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [{ type: 'thinking', text: 'weighing' }]);
  });
});

describe('Folding hub tool blocks', () => {
  it('should parse the argument deltas into the tool input', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_1', name: 'lookup' } },
        { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '{"city":' } },
        { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '"Ankara"}' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [
      { type: 'tool_use', id: 'call_1', name: 'lookup', input: { city: 'Ankara' } },
    ]);
  });

  it('should read a tool call that streamed no arguments as an empty input', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_1', name: 'ping' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [
      { type: 'tool_use', id: 'call_1', name: 'ping', input: {} },
    ]);
  });

  it('should read a tool call whose arguments are not an object as empty', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'tool', id: 'call_1', name: 'ping' } },
        { type: 'block-delta', index: 0, delta: { kind: 'json-args', partialJson: '"text"' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content.0.input', {});
  });
});

describe('Folding hub block signatures', () => {
  it('should keep the signature the tool block opened with', async () => {
    const collected = await collectHubResponse(
      streamOf([
        {
          type: 'block-open',
          index: 0,
          opening: { kind: 'tool', id: 'call_1', name: 'ping', signature: 'sig-open' },
        },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content.0.signature', 'sig-open');
  });

  it('should keep a text block that opened with a signature free of one', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'text', signature: 'sig-open' } },
        { type: 'block-close', index: 0 },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [{ type: 'text', text: '' }]);
  });
});

describe('Folding hub media events', () => {
  it('should append a standalone media block to the response content', async () => {
    const collected = await collectHubResponse(
      streamOf([
        {
          type: 'media',
          block: {
            type: 'image',
            source: { type: 'base64', mediaType: 'image/png', data: 'aGk=' },
          },
        },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content', [
      { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'aGk=' } },
    ]);
  });

  it('should keep media and text blocks in the order the stream delivered them', async () => {
    const collected = await collectHubResponse(
      streamOf([
        { type: 'block-open', index: 0, opening: { kind: 'text' } },
        { type: 'block-delta', index: 0, delta: { kind: 'text', text: 'here' } },
        { type: 'block-close', index: 0 },
        {
          type: 'media',
          block: {
            type: 'audio',
            source: { type: 'base64', mediaType: 'audio/wav', data: 'QQ==' },
          },
        },
        ending(),
      ]),
    );

    expect(collected).toHaveProperty('content.1.type', 'audio');
  });
});
