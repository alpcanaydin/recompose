import { describe, expect, it } from 'vitest';

import { normalizeXAIReasoningEvent } from './xai-websocket-response';

describe('Passing a xAI event that needs no reasoning translation', () => {
  it('should pass a value that is not an event through untouched', () => {
    expect(normalizeXAIReasoningEvent('raw')).toEqual(['raw']);
  });

  it('should pass an event without a type through untouched', () => {
    expect(normalizeXAIReasoningEvent({ text: 'hi' })).toEqual([{ text: 'hi' }]);
  });

  it('should pass an event of an untranslated type through untouched', () => {
    expect(normalizeXAIReasoningEvent({ type: 'response.created' })).toEqual([
      { type: 'response.created' },
    ]);
  });
});

describe('Translating a xAI reasoning part into a summary part', () => {
  it('should rename an opening reasoning part as a summary part', () => {
    const normalized = normalizeXAIReasoningEvent({
      type: 'response.content_part.added',
      part: { type: 'reasoning_text', text: '' },
    });

    expect(normalized).toEqual([
      {
        type: 'response.reasoning_summary_part.added',
        summary_index: 0,
        part: { type: 'summary_text', text: '' },
      },
    ]);
  });

  it('should leave an opening part that carries no reasoning alone', () => {
    const event = { type: 'response.content_part.added', part: { type: 'output_text' } };

    expect(normalizeXAIReasoningEvent(event)).toEqual([event]);
  });

  it('should leave an opening part that is not an object alone', () => {
    const event = { type: 'response.content_part.added', part: 'reasoning_text' };

    expect(normalizeXAIReasoningEvent(event)).toEqual([event]);
  });
});

describe('Translating xAI reasoning text into summary text', () => {
  it('should rename a reasoning delta as a summary delta', () => {
    const normalized = normalizeXAIReasoningEvent({
      type: 'response.reasoning_text.delta',
      delta: 'weigh',
    });

    expect(normalized).toEqual([
      { type: 'response.reasoning_summary_text.delta', delta: 'weigh', summary_index: 0 },
    ]);
  });

  it('should close reasoning text with a summary text and a summary part', () => {
    const normalized = normalizeXAIReasoningEvent({
      type: 'response.reasoning_text.done',
      text: 'weighed it',
    });

    expect(normalized).toEqual([
      { type: 'response.reasoning_summary_text.done', text: 'weighed it', summary_index: 0 },
      {
        type: 'response.reasoning_summary_part.done',
        text: 'weighed it',
        summary_index: 0,
        part: { type: 'summary_text', text: 'weighed it' },
      },
    ]);
  });

  it('should close reasoning that carried no text with an empty summary part', () => {
    const normalized = normalizeXAIReasoningEvent({ type: 'response.reasoning_text.done' });

    expect(normalized).toHaveProperty('1.part', { type: 'summary_text', text: '' });
  });
});

describe('Translating a completed xAI reasoning item', () => {
  it('should move the reasoning content into the item summary', () => {
    const normalized = normalizeXAIReasoningEvent({
      type: 'response.output_item.done',
      item: {
        type: 'reasoning',
        content: [
          { type: 'reasoning_text', text: 'weighed it' },
          { type: 'output_text', text: 'ignored' },
          'raw',
        ],
      },
    });

    expect(normalized).toEqual([
      {
        type: 'response.output_item.done',
        item: {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'weighed it' }],
          content: [],
        },
      },
    ]);
  });

  it('should summarise a reasoning part that carried no text as empty', () => {
    const normalized = normalizeXAIReasoningEvent({
      type: 'response.output_item.done',
      item: { type: 'reasoning', content: [{ type: 'reasoning_text' }] },
    });

    expect(normalized).toHaveProperty('0.item.summary', [{ type: 'summary_text', text: '' }]);
  });

  it('should leave a completed item that carries no reasoning alone', () => {
    const event = { type: 'response.output_item.done', item: { type: 'message', content: [] } };

    expect(normalizeXAIReasoningEvent(event)).toEqual([event]);
  });

  it('should leave a reasoning item whose content is not a list alone', () => {
    const event = { type: 'response.output_item.done', item: { type: 'reasoning', content: 'x' } };

    expect(normalizeXAIReasoningEvent(event)).toEqual([event]);
  });

  it('should leave a completed item that is not an object alone', () => {
    const event = { type: 'response.output_item.done', item: 'reasoning' };

    expect(normalizeXAIReasoningEvent(event)).toEqual([event]);
  });
});
