import { describe, expect, it } from 'vitest';

import type { GeminiCarrier } from '../provider/gemini-responses-carrier';
import type { HubMessage } from './hub';
import type { ResponsesInputItem, ResponsesReasoningItem } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import {
  foldNextGeminiTextCarrier,
  foldPreviousGeminiTextCarrier,
} from './responses-gemini-text-carrier';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

describe('a Gemini carrier that signs the text after it', () => {
  it('should sign the first text block of the message that follows', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      userMessageItem(),
      () => ({ messages: [assistantSaying('first', 'second')], fates: [] }),
    );

    expect(folded).toEqual({
      outcome: {
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'first', signature },
              { type: 'text', text: 'second' },
            ],
          },
        ],
        fates: [{ field: 'encrypted_content', disposition: 'carried' }],
      },
      consumed: 2,
    });
  });

  it('should refuse a reasoning item that carries no encrypted content', () => {
    const folded = foldNextGeminiTextCarrier({ type: 'reasoning' }, userMessageItem(), everyFold);

    expect(folded).toBeNull();
  });

  it('should refuse an encrypted content that carries no carrier marking', () => {
    const folded = foldNextGeminiTextCarrier(
      { type: 'reasoning', encrypted_content: signature },
      userMessageItem(),
      everyFold,
    );

    expect(folded).toBeNull();
  });

  it('should refuse a carrier marking this engine cannot read', () => {
    const folded = foldNextGeminiTextCarrier(
      { type: 'reasoning', encrypted_content: 'cpa-gemini-responses-carrier-v1:sideways::' },
      userMessageItem(),
      everyFold,
    );

    expect(folded).toBeNull();
  });

  it('should refuse a carrier that points the other way or at another target', () => {
    const backwards = carrierItem({ signature, direction: 'previous', target: 'text' });
    const functionBound = carrierItem({ signature, direction: 'next', target: 'function' });

    expect(foldNextGeminiTextCarrier(backwards, userMessageItem(), everyFold)).toBeNull();
    expect(foldNextGeminiTextCarrier(functionBound, userMessageItem(), everyFold)).toBeNull();
  });
});

describe('a Gemini carrier with nothing it can sign', () => {
  it('should refuse a carrier that no message follows', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      { type: 'function_call', call_id: 'call_1', name: 'read_file', arguments: '{}' },
      everyFold,
    );

    expect(folded).toBeNull();
  });

  it('should refuse a following message that folds into nothing', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      userMessageItem(),
      () => ({ messages: [], fates: [] }),
    );

    expect(folded).toBeNull();
  });

  it('should refuse to sign a message the model did not speak', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      userMessageItem(),
      () => ({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        fates: [],
      }),
    );

    expect(folded).toBeNull();
  });

  it('should refuse a message that says nothing in words', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      userMessageItem(),
      () => ({
        messages: [{ role: 'assistant', content: [{ type: 'thinking', text: 'quiet' }] }],
        fates: [],
      }),
    );

    expect(folded).toBeNull();
  });
});

describe('a Gemini carrier that finds a text block to sign', () => {
  it('should refuse a text block that another carrier already signed', () => {
    const folded = foldNextGeminiTextCarrier(
      carrierItem({ signature, direction: 'next', target: 'text' }),
      userMessageItem(),
      () => ({
        messages: [
          { role: 'assistant', content: [{ type: 'text', text: 'first', signature: 'other' }] },
        ],
        fates: [],
      }),
    );

    expect(folded).toBeNull();
  });
});

describe('a Gemini carrier that signs the text before it', () => {
  it('should sign the last text block of the message it follows', () => {
    const messages: HubMessage[] = [assistantSaying('first', 'second')];

    const fates = foldPreviousGeminiTextCarrier(
      carrierItem({ signature, direction: 'previous', target: 'text' }),
      messages,
    );

    expect(fates).toEqual([{ field: 'encrypted_content', disposition: 'carried' }]);
    expect(messages[0]?.content).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second', signature },
    ]);
  });

  it('should refuse a carrier that no message precedes', () => {
    const fates = foldPreviousGeminiTextCarrier(
      carrierItem({ signature, direction: 'previous', target: 'text' }),
      [],
    );

    expect(fates).toBeNull();
  });

  it('should refuse a carrier this engine cannot read at all', () => {
    const fates = foldPreviousGeminiTextCarrier({ type: 'reasoning' }, [assistantSaying('first')]);

    expect(fates).toBeNull();
  });

  it('should leave a preceding message that has no words to sign', () => {
    const messages: HubMessage[] = [
      { role: 'assistant', content: [{ type: 'thinking', text: 'quiet' }] },
    ];

    const fates = foldPreviousGeminiTextCarrier(
      carrierItem({ signature, direction: 'previous', target: 'text' }),
      messages,
    );

    expect(fates).toBeNull();
    expect(messages[0]?.content).toEqual([{ type: 'thinking', text: 'quiet' }]);
  });
});

function carrierItem(carrier: GeminiCarrier): ResponsesReasoningItem {
  return { type: 'reasoning', encrypted_content: encodeGeminiResponsesCarrier(carrier) };
}

function userMessageItem(): ResponsesInputItem {
  return { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] };
}

function assistantSaying(...texts: readonly string[]): HubMessage {
  return { role: 'assistant', content: texts.map((text) => ({ type: 'text', text })) };
}

function everyFold(): { messages: HubMessage[]; fates: [] } {
  return { messages: [assistantSaying('folded')], fates: [] };
}
