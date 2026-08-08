import { describe, expect, test } from 'vitest';

import type { GeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import type { HubContentBlock, HubResponse } from './hub';

import { decodeGeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import { geminiClaudeCarrierResponse } from './gemini-claude-carrier-content';

const PAYLOAD = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
const CONTAINER = Buffer.concat([Buffer.from([0x0a, PAYLOAD.length]), PAYLOAD]);
const NATIVE_SIGNATURE = Buffer.concat([Buffer.from([0x12, CONTAINER.length]), CONTAINER]).toString(
  'base64',
);

const BYPASS_SIGNATURE = 'skip_thought_signature_validator';

function responseHolding(...content: readonly HubContentBlock[]): HubResponse {
  return { content, stopReason: 'end', usage: {} };
}

function carriedBlocks(...content: readonly HubContentBlock[]): HubContentBlock[] {
  return [...geminiClaudeCarrierResponse(responseHolding(...content)).content];
}

function carrierOf(block: HubContentBlock | undefined): GeminiClaudeCarrier | null {
  return block?.type === 'thinking' ? decodeGeminiClaudeCarrier(block.signature) : null;
}

describe('a signed block is preceded by its Gemini carrier', () => {
  test('a thinking block hands its signature to a carrier aimed at the text ahead', () => {
    const blocks = carriedBlocks({
      type: 'thinking',
      text: 'weighing it up',
      signature: NATIVE_SIGNATURE,
    });

    expect(carrierOf(blocks.at(0))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'next',
      target: 'text',
    });
    expect(blocks.at(1)).toStrictEqual({ type: 'thinking', text: 'weighing it up' });
  });

  test('a tool call hands its signature to a carrier aimed at the function ahead', () => {
    const blocks = carriedBlocks({
      type: 'tool_use',
      id: 'call_1',
      name: 'lookup',
      input: {},
      signature: NATIVE_SIGNATURE,
    });

    expect(carrierOf(blocks.at(0))?.target).toBe('function');
    expect(blocks.at(1)).toStrictEqual({
      type: 'tool_use',
      id: 'call_1',
      name: 'lookup',
      input: {},
    });
  });
});

describe('an empty signed text block becomes a detached carrier', () => {
  test('a carrier following visible content points back at it', () => {
    const blocks = carriedBlocks(
      { type: 'text', text: 'the answer' },
      { type: 'text', text: '', signature: NATIVE_SIGNATURE },
    );

    expect(blocks).toHaveLength(2);
    expect(carrierOf(blocks.at(1))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'previous',
      target: 'text',
    });
  });

  test('a leading carrier points forward at the tool call that follows', () => {
    const blocks = carriedBlocks(
      { type: 'text', text: '', signature: NATIVE_SIGNATURE },
      { type: 'tool_use', id: 'call_1', name: 'lookup', input: {} },
    );

    expect(carrierOf(blocks.at(0))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'next',
      target: 'function',
    });
  });

  test('a lone carrier with nothing around it points forward at text', () => {
    const blocks = carriedBlocks({ type: 'text', text: '', signature: NATIVE_SIGNATURE });

    expect(blocks).toHaveLength(1);
    expect(carrierOf(blocks.at(0))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'next',
      target: 'text',
    });
  });
});

describe('aiming a detached carrier at its neighbors', () => {
  test('a carrier following a thinking block points back at its text', () => {
    const blocks = carriedBlocks(
      { type: 'thinking', text: 'weighing it up' },
      { type: 'text', text: '', signature: NATIVE_SIGNATURE },
    );

    expect(carrierOf(blocks.at(1))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'previous',
      target: 'text',
    });
  });

  test('neighbors that carry no semantics are stepped over when aiming the carrier', () => {
    const blocks = carriedBlocks(
      { type: 'redacted_thinking', data: 'opaque' },
      { type: 'text', text: '', signature: NATIVE_SIGNATURE },
      { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
    );

    expect(carrierOf(blocks.at(1))).toStrictEqual({
      signature: NATIVE_SIGNATURE,
      direction: 'next',
      target: 'text',
    });
  });
});

describe('a block the carrier cannot speak for is left untouched', () => {
  test('a bypass sentinel is not a native signature and stays put', () => {
    const blocks = carriedBlocks({
      type: 'thinking',
      text: 'weighing it up',
      signature: BYPASS_SIGNATURE,
    });

    expect(blocks).toStrictEqual([
      { type: 'thinking', text: 'weighing it up', signature: BYPASS_SIGNATURE },
    ]);
  });

  test('a foreign signature stays put', () => {
    const blocks = carriedBlocks({ type: 'text', text: 'hello', signature: 'anthropic#abc' });

    expect(blocks).toStrictEqual([{ type: 'text', text: 'hello', signature: 'anthropic#abc' }]);
  });
});

describe('a block that holds no signature at all', () => {
  test('a block that carries no signature stays put', () => {
    const blocks = carriedBlocks({ type: 'text', text: 'hello' });

    expect(blocks).toStrictEqual([{ type: 'text', text: 'hello' }]);
  });

  test('a block type that holds no signature stays put', () => {
    const image: HubContentBlock = {
      type: 'image',
      source: { type: 'url', url: 'https://example.test/a.png' },
    };

    expect(carriedBlocks(image)).toStrictEqual([image]);
  });

  test('a tool result stays put even beside signed neighbors', () => {
    const result: HubContentBlock = {
      type: 'tool_result',
      toolUseId: 'call_1',
      content: [{ type: 'text', text: 'done' }],
    };

    expect(carriedBlocks(result)).toStrictEqual([result]);
  });
});
