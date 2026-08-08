import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame, ChatUsage } from './chat-completions-wire';
import type { ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

import { collect } from './chat-completions.testkit';
import { translateResponse, translateStream } from './dispatcher';

describe('Codex cache-write usage crossing Chat Completions non-stream', () => {
  it('should forward cache-write tokens', () => {
    expect(nonStreamUsage(responseWithCacheWrite(40))).toEqual(chatUsageWithCacheWrite(40));
  });

  it('should omit missing cache-write tokens', () => {
    expect(nonStreamUsage(responseWithoutCacheWrite())).toEqual(chatUsageWithoutCacheWrite());
  });

  it('should preserve an explicit zero cache-write count', () => {
    expect(nonStreamUsage(responseWithCacheWrite(0))).toEqual(chatUsageWithCacheWrite(0));
  });
});

describe('Codex cache-write usage crossing Chat Completions streams', () => {
  it('should forward cache-write tokens', async () => {
    expect(await streamUsage(responseWithCacheWrite(40))).toEqual(chatUsageWithCacheWrite(40));
  });

  it('should omit missing cache-write tokens', async () => {
    expect(await streamUsage(responseWithoutCacheWrite())).toEqual(chatUsageWithoutCacheWrite());
  });

  it('should preserve an explicit zero cache-write count', async () => {
    expect(await streamUsage(responseWithCacheWrite(0))).toEqual(chatUsageWithCacheWrite(0));
  });
});

// Helpers

function responseWithCacheWrite(cacheWriteTokens: number): ResponsesResponse {
  return responseWithInputDetails({ cached_tokens: 30, cache_write_tokens: cacheWriteTokens });
}

function responseWithoutCacheWrite(): ResponsesResponse {
  return responseWithInputDetails({ cached_tokens: 30 });
}

function responseWithInputDetails(
  inputDetails: NonNullable<NonNullable<ResponsesResponse['usage']>['input_tokens_details']>,
): ResponsesResponse {
  return {
    id: 'resp_cache',
    model: 'gpt-5.4',
    status: 'completed',
    output: [
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      input_tokens_details: inputDetails,
      output_tokens_details: { reasoning_tokens: 5 },
    },
  };
}

function chatUsageWithCacheWrite(cacheWriteTokens: number): ChatUsage {
  return {
    ...chatUsageWithoutCacheWrite(),
    prompt_tokens_details: { cached_tokens: 30, cached_creation_tokens: cacheWriteTokens },
  };
}

function chatUsageWithoutCacheWrite(): ChatUsage {
  return {
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    prompt_tokens_details: { cached_tokens: 30 },
    completion_tokens_details: { reasoning_tokens: 5 },
  };
}

function nonStreamUsage(response: ResponsesResponse): ChatUsage | undefined {
  const translated = translateResponse('responses', 'chat-completions', response);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

  return translated.value.usage;
}

async function streamUsage(response: ResponsesResponse): Promise<ChatUsage | undefined> {
  const source: readonly ResponsesStreamEvent[] = [{ type: 'response.completed', response }];
  const translated = translateStream('responses', 'chat-completions', streamOf(source));

  if ('outcome' in translated) throw new Error('expected stream');

  const frames = await collect(translated.stream);

  return frames.flatMap(usageFromFrame)[0];
}

function usageFromFrame(frame: ChatStreamFrame): ChatUsage[] {
  if (frame.type !== 'chunk') return [];
  if (frame.chunk.usage == null) return [];

  return [frame.chunk.usage];
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}
