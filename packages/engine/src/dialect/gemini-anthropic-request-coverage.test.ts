import { describe, expect, test } from 'vitest';

import type { TranslationRefusal } from '../refusals';
import type { TranslateResult } from './fates';
import type { HubContentBlock, HubRequest } from './hub';

import { geminiRequestForAnthropic } from './gemini-anthropic-request';

function translated(value: HubRequest): TranslateResult<HubRequest, TranslationRefusal> {
  return { value, fates: [] };
}

function requestOf(...content: readonly HubContentBlock[]): HubRequest {
  return { messages: [{ role: 'user', content }] };
}

function translatedRequest(decoded: TranslateResult<HubRequest, TranslationRefusal>): HubRequest {
  if ('refusal' in decoded) throw new Error('expected a translation, met a refusal');

  return decoded.value;
}

function firstBlock(value: HubRequest): HubContentBlock | undefined {
  return value.messages.at(0)?.content.at(0);
}

describe('a Gemini turn reshaped for an Anthropic target', () => {
  test('a refusal upstream travels on untouched', () => {
    const refused: TranslateResult<HubRequest, TranslationRefusal> = {
      refusal: { reason: 'empty-conversation' },
    };

    expect(geminiRequestForAnthropic(refused)).toBe(refused);
  });

  test('audio held at a URL becomes the URL itself', () => {
    const decoded = translated(
      requestOf({ type: 'audio', source: { type: 'url', url: 'https://example.test/a.mp3' } }),
    );

    expect(firstBlock(translatedRequest(geminiRequestForAnthropic(decoded)))).toStrictEqual({
      type: 'text',
      text: 'https://example.test/a.mp3',
    });
  });

  test('video held inline becomes a data URL', () => {
    const decoded = translated(
      requestOf({
        type: 'video',
        source: { type: 'base64', mediaType: 'video/mp4', data: 'AAAA' },
      }),
    );

    expect(firstBlock(translatedRequest(geminiRequestForAnthropic(decoded)))).toStrictEqual({
      type: 'text',
      text: 'data:video/mp4;base64,AAAA',
    });
  });
});

describe('what a Gemini turn loses on the way to Anthropic', () => {
  test('a system instruction is spoken as the opening user turn', () => {
    const decoded = translated({
      system: [{ text: 'be terse' }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });
    const value = translatedRequest(geminiRequestForAnthropic(decoded));

    expect(value.messages.at(0)).toStrictEqual({
      role: 'user',
      boundary: 'system-reminder',
      content: [{ type: 'text', text: 'be terse' }],
    });
    expect(value.system).toBeUndefined();
  });

  test('a temperature Anthropic will not honour is dropped and recorded', () => {
    const decoded = translated({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      sampling: { temperature: 0.7, topP: 0.9 },
    });
    const result = geminiRequestForAnthropic(decoded);

    expect(translatedRequest(result).sampling).toStrictEqual({ topP: 0.9 });
    expect('refusal' in result ? [] : result.fates).toContainEqual({
      field: 'temperature',
      disposition: 'mapped',
      to: 'absent',
    });
  });

  test('a turn that declares no sampling keeps none', () => {
    const decoded = translated(requestOf({ type: 'text', text: 'hello' }));

    expect(translatedRequest(geminiRequestForAnthropic(decoded)).sampling).toBeUndefined();
  });
});
