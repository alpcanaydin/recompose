import { describe, expect, it } from 'vitest';

import type { HubMessage } from './hub';

import {
  imageBlockFromDataUri,
  imageSourceFromUrl,
  mergeAdjacentSameRole,
  parseToolArguments,
} from './hub-build';

describe('parseToolArguments: a tool call degrades to an empty object rather than throwing', () => {
  it('reads a valid json object', () => {
    expect(parseToolArguments('{"city":"Paris"}')).toEqual({ city: 'Paris' });
  });

  it('falls back to an empty object on empty, malformed, or non-object json', () => {
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('{')).toEqual({});
    expect(parseToolArguments('not json')).toEqual({});
    expect(parseToolArguments('[1,2]')).toEqual({});
    expect(parseToolArguments('null')).toEqual({});
  });
});

describe('imageSourceFromUrl: a declared image resolves its source honestly', () => {
  it('keeps a fetchable url as a url source', () => {
    expect(imageSourceFromUrl('https://example.test/cat.png')).toEqual({
      type: 'url',
      url: 'https://example.test/cat.png',
    });
  });

  it('parses a base64 data uri into a base64 source', () => {
    expect(imageSourceFromUrl('data:image/png;base64,AAA')).toEqual({
      type: 'base64',
      mediaType: 'image/png',
      data: 'AAA',
    });
  });

  it('keeps a malformed data uri as a url source rather than a broken base64 source', () => {
    expect(imageSourceFromUrl('data:image/png,AAA')).toEqual({
      type: 'url',
      url: 'data:image/png,AAA',
    });
    expect(imageSourceFromUrl('data:;base64,AAA')).toEqual({
      type: 'url',
      url: 'data:;base64,AAA',
    });
  });
});

describe('imageBlockFromDataUri: an arbitrary output becomes an image only when it is a base64 data uri', () => {
  it('reads a base64 data uri as an image block', () => {
    expect(imageBlockFromDataUri('data:image/png;base64,AAA')).toEqual({
      type: 'image',
      source: { type: 'base64', mediaType: 'image/png', data: 'AAA' },
    });
  });

  it('leaves a non-image string unclaimed', () => {
    expect(imageBlockFromDataUri('sunny, 21C')).toBeUndefined();
    expect(imageBlockFromDataUri('blob:image/png;base64,AAA')).toBeUndefined();
    expect(imageBlockFromDataUri('data:;base64,AAA')).toBeUndefined();
  });

  it('leaves a non-image data uri media type unclaimed', () => {
    expect(imageBlockFromDataUri('data:application/pdf;base64,AAA')).toBeUndefined();
  });
});

describe('mergeAdjacentSameRole: a strict target reads strictly alternating turns', () => {
  it('folds a run of same-role turns into one, concatenating content in order', () => {
    const turns: HubMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'one' }] },
      { role: 'user', content: [{ type: 'text', text: 'two' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'three' }] },
    ];

    expect(mergeAdjacentSameRole(turns)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'three' }] },
    ]);
  });

  it('leaves already-alternating turns untouched and an empty list empty', () => {
    const alternating: HubMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'a' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'b' }] },
    ];

    expect(mergeAdjacentSameRole(alternating)).toEqual(alternating);
    expect(mergeAdjacentSameRole([])).toEqual([]);
  });
});
