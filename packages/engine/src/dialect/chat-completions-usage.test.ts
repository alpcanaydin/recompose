import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { HubResponse, HubStreamEvent } from './hub';

import { decodeResponse, encodeResponse } from './chat-completions-response';
import { encodeStream } from './chat-completions-stream';
import { chatUsageFromHub } from './chat-completions-usage';
import { aChatResponse, collect, streamOf } from './chat-completions.testkit';
import { aHubResponse } from './hub.testkit';

describe('cache token details are reported only for the sides that were counted', () => {
  it('reports a cache write on its own without inventing a cache read', () => {
    expect(chatUsageFromHub({ outputTokens: 4, cacheWriteTokens: 7 })).toEqual({
      prompt_tokens: 7,
      completion_tokens: 4,
      total_tokens: 11,
      prompt_tokens_details: { cached_creation_tokens: 7 },
    });
  });

  it('reports a cache read on its own without inventing a cache write', () => {
    expect(chatUsageFromHub({ inputTokens: 1, outputTokens: 4, cacheReadTokens: 6 })).toEqual({
      prompt_tokens: 7,
      completion_tokens: 4,
      total_tokens: 11,
      prompt_tokens_details: { cached_tokens: 6 },
    });
  });

  it('reports no cache details at all when neither side was counted', () => {
    expect(chatUsageFromHub({})).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });
});

function encodedUsage(hub: HubResponse) {
  const result = encodeResponse(hub);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result.value.usage;
}

function streamUsage(frames: readonly ChatStreamFrame[]) {
  for (const frame of frames) {
    if (frame.type === 'chunk' && frame.chunk.usage != null) {
      return frame.chunk.usage;
    }
  }

  return undefined;
}

describe('the codec maps cache tokens through the response usage both ways', () => {
  it('decodes cached prompt tokens as the cache read, leaving the uncached remainder as input', () => {
    const response = aChatResponse({
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    });

    expect(decodeResponse(response).value.usage).toEqual({
      inputTokens: 6,
      outputTokens: 8,
      cacheReadTokens: 4,
    });
  });

  it('encodes the cache read back into prompt tokens and the cached-tokens detail', () => {
    expect(
      encodedUsage(
        aHubResponse({ usage: { inputTokens: 6, outputTokens: 8, cacheReadTokens: 4 } }),
      ),
    ).toEqual({
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18,
      prompt_tokens_details: { cached_tokens: 4 },
    });
  });

  it('folds the cache write into prompt tokens alongside the input and the cache read', () => {
    expect(
      encodedUsage(
        aHubResponse({
          usage: { inputTokens: 6, outputTokens: 8, cacheReadTokens: 4, cacheWriteTokens: 5 },
        }),
      ),
    ).toEqual({
      prompt_tokens: 15,
      completion_tokens: 8,
      total_tokens: 23,
      prompt_tokens_details: { cached_tokens: 4, cached_creation_tokens: 5 },
    });
  });
});

describe('encodeStream merges the opening usage with the closing usage', () => {
  it('overwrites output tokens from the message end rather than summing the opening count', async () => {
    const events: readonly HubStreamEvent[] = [
      { type: 'message-begin', usage: { inputTokens: 10, cacheReadTokens: 4, outputTokens: 1 } },
      { type: 'message-end', stopReason: 'end', usage: { outputTokens: 25 } },
    ];

    const frames = await collect(encodeStream(streamOf(events)));

    expect(streamUsage(frames)).toEqual({
      prompt_tokens: 14,
      completion_tokens: 25,
      total_tokens: 39,
      prompt_tokens_details: { cached_tokens: 4 },
    });
  });
});

describe('the codec carries reasoning and aggregate Chat usage', () => {
  it('decodes reasoning-token details into the hub', () => {
    const response = aChatResponse({
      usage: {
        prompt_tokens: 2,
        completion_tokens: 6,
        total_tokens: 8,
        completion_tokens_details: { reasoning_tokens: 3 },
      },
    });

    expect(decodeResponse(response).value.usage).toMatchObject({ reasoningTokens: 3 });
  });

  it('encodes reasoning details and total tokens from the hub', () => {
    const usage = encodedUsage(
      aHubResponse({ usage: { inputTokens: 2, outputTokens: 6, reasoningTokens: 3 } }),
    );

    expect(usage).toMatchObject({
      prompt_tokens: 2,
      completion_tokens: 6,
      total_tokens: 8,
      completion_tokens_details: { reasoning_tokens: 3 },
    });
  });
});
