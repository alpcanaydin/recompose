import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { decodeRequest } from './responses-codec';
import {
  aCompatibleReasoningItem,
  aForeignReasoningItem,
  aRedactedReasoningItem,
  aResponsesReasoningItem,
  aResponsesRequest,
  aResponsesUserMessage,
  expectTranslation,
  fateFor,
  redactedThinkingOf,
  thinkingOf,
} from './responses.testkit';

describe('decodeRequest: a reasoning item crosses by the compatibility of its signature', () => {
  it('carries a compatible signature onto the thinking block without fabricating one', () => {
    const { value, fates } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aCompatibleReasoningItem('sig-abc')] })),
    );

    const [thinking] = thinkingOf(value.messages);

    expect(thinking?.text).toBe('weigh the two routes before answering');
    expect(thinking?.signature).toBe('sig-abc');
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'thinking.signature',
    });
  });

  it('maps redacted content to a redacted thinking block that preserves the data', () => {
    const { value, fates } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aRedactedReasoningItem('redacted-blob-1')] })),
    );

    const [redacted] = redactedThinkingOf(value.messages);

    expect(redacted?.data).toBe('redacted-blob-1');
    expect(thinkingOf(value.messages)).toHaveLength(0);
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'redacted_thinking',
    });
  });

  it('drops a foreign-provider signature rather than crossing it as a fabricated one', () => {
    const { value, fates } = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          input: [aResponsesUserMessage(), aForeignReasoningItem({ summary: [] })],
        }),
      ),
    );

    expect(thinkingOf(value.messages)).toHaveLength(0);
    expect(redactedThinkingOf(value.messages)).toHaveLength(0);
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});

describe('decodeRequest: an empty reasoning item never fabricates a thinking block', () => {
  it('drops a summary-less reasoning item rather than emitting an empty thinking block', () => {
    const { value } = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          input: [aResponsesUserMessage(), aResponsesReasoningItem({ summary: [] })],
        }),
      ),
    );

    expect(thinkingOf(value.messages)).toHaveLength(0);
    expect(value.messages.map((message) => message.role)).toEqual(['user']);
  });

  it('keeps an empty compatible reasoning item because its signature is replayable state', () => {
    const item = aCompatibleReasoningItem('sig-x', { summary: [] });
    const { value, fates } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aResponsesUserMessage(), item] })),
    );

    expect(thinkingOf(value.messages)).toContainEqual({
      type: 'thinking',
      text: '',
      signature: 'sig-x',
    });
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'thinking.signature',
    });
  });
});

describe('decodeRequest: a foreign reasoning turn still carries its readable summary', () => {
  it('keeps a foreign signature turn as thinking when it still carries a readable summary', () => {
    const { value, fates } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aForeignReasoningItem()] })),
    );

    const [thinking] = thinkingOf(value.messages);

    expect(thinking?.text).toBe('weigh the two routes before answering');
    expect(thinking?.signature).toBeUndefined();
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});

describe('decodeRequest: a plain reasoning item stands as an assistant thinking turn', () => {
  it('crosses a summary-only reasoning item to an assistant turn with no encrypted-content fate', () => {
    const { value, fates } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aResponsesReasoningItem()] })),
    );

    const [thinking] = thinkingOf(value.messages);

    expect(value.messages[0]?.role).toBe('assistant');
    expect(thinking?.text).toBe('weigh the two routes before answering');
    expect(thinking?.signature).toBeUndefined();
    expect(fates).toEqual([{ field: 'input', disposition: 'mapped', to: 'messages' }]);
  });

  it('joins several reasoning summary parts into the thinking text by newline', () => {
    const item = aResponsesReasoningItem({
      summary: [
        { type: 'summary_text', text: 'first weigh the routes' },
        { type: 'summary_text', text: 'then commit to one' },
      ],
    });

    const { value } = expectTranslation(decodeRequest(aResponsesRequest({ input: [item] })));

    const [thinking] = thinkingOf(value.messages);

    expect(thinking?.text).toBe('first weigh the routes\nthen commit to one');
  });

  test.prop([fc.string()])(
    'carries any compatible signature onto the thinking block verbatim, never fabricating one',
    (signature) => {
      const { value } = expectTranslation(
        decodeRequest(aResponsesRequest({ input: [aCompatibleReasoningItem(signature)] })),
      );

      const [thinking] = thinkingOf(value.messages);

      expect(thinking?.signature).toBe(signature);
    },
  );
});
