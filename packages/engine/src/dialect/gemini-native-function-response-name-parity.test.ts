import { describe, expect, it } from 'vitest';

import type { GeminiContent, GeminiRequest } from './gemini-wire';

import { translateRequestToGemini } from './gemini-bridge';
import { backfillGeminiFunctionResponseNames } from './gemini-native-request';

describe('native Gemini function-response name backfill', () => {
  it('should backfill one empty response name', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(callTurn('Bash'), responseTurn('')),
    );

    expect(responseNames(normalized)).toEqual(['Bash']);
  });

  it('should backfill parallel response names in FIFO order', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(callTurn('Read', 'Grep'), responseTurn('', '')),
    );

    expect(responseNames(normalized)).toEqual(['Read', 'Grep']);
  });

  it('should preserve an existing response name', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(callTurn('Bash'), responseTurn('Bash')),
    );

    expect(responseNames(normalized)).toEqual(['Bash']);
  });
});

describe('native Gemini request normalization seam', () => {
  it('should backfill an empty name while translating Gemini to Gemini', () => {
    const translated = translateRequestToGemini(
      'gemini',
      requestOf(callTurn('Bash'), responseTurn('')),
    );

    expect(translated).toHaveProperty('value.contents.1.parts.0.functionResponse.name', 'Bash');
  });

  it('should leave responses beyond the preceding call count empty', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(callTurn('Bash'), responseTurn('', '')),
    );

    expect(responseNames(normalized)).toEqual(['Bash', '']);
  });

  it('should backfill each sequential call and response group independently', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(callTurn('Read'), responseTurn(''), callTurn('Grep'), responseTurn('')),
    );

    expect(responseNames(normalized)).toEqual(['Read', 'Grep']);
  });
});

function requestOf(...contents: GeminiContent[]): GeminiRequest {
  return { contents };
}

function callTurn(...names: string[]): GeminiContent {
  return {
    role: 'model',
    parts: names.map((name) => ({ functionCall: { name, args: {} } })),
  };
}

function responseTurn(...names: string[]): GeminiContent {
  return {
    role: 'user',
    parts: names.map((name) => ({ functionResponse: { name, response: { result: 'ok' } } })),
  };
}

function responseNames(request: GeminiRequest): string[] {
  return request.contents.flatMap((content) =>
    content.parts.flatMap((part) => {
      const response = part.functionResponse;

      return response === undefined ? [] : [response.name];
    }),
  );
}
