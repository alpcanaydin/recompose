import { describe, expect, it } from 'vitest';

import { hubBlockFromResponsesPart } from './responses-media-decode';

describe('hubBlockFromResponsesPart carries the cache breakpoint of a text part', () => {
  it('marks an ephemeral breakpoint without a lifetime when the part names none', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_text',
      text: 'remember this',
      cache_control: { type: 'ephemeral' },
    });

    expect(block).toEqual({
      type: 'text',
      text: 'remember this',
      cacheBreakpoint: { type: 'ephemeral' },
    });
  });

  it('carries the lifetime an output text part asks for', () => {
    const block = hubBlockFromResponsesPart({
      type: 'output_text',
      text: 'the answer',
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });

    expect(block).toEqual({
      type: 'text',
      text: 'the answer',
      cacheBreakpoint: { type: 'ephemeral', ttl: '1h' },
    });
  });
});

describe('hubBlockFromResponsesPart reads the detail an image part asks for', () => {
  it('keeps a detail the hub speaks', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/cat.png',
      detail: 'high',
    });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://example.test/cat.png' },
      detail: 'high',
    });
  });

  it('drops a detail the hub does not speak', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/cat.png',
      detail: 'ultra',
    });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://example.test/cat.png' },
    });
  });
});

describe('hubBlockFromResponsesPart reads an audio part as a base64 audio block', () => {
  it('names the media type after the format the part declares', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_audio',
      input_audio: { data: 'QUJD', format: 'wav' },
    });

    expect(block).toEqual({
      type: 'audio',
      source: { type: 'base64', mediaType: 'audio/wav', data: 'QUJD' },
    });
  });
});

describe('hubBlockFromResponsesPart reads a file part as a document block', () => {
  it('takes the media type and the payload from an inline data url', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_file',
      filename: 'sheet.csv',
      file_data: 'data:text/csv;base64,QSxC',
    });

    expect(block).toEqual({
      type: 'document',
      source: { type: 'base64', mediaType: 'text/csv', data: 'QSxC' },
      filename: 'sheet.csv',
    });
  });

  it('falls back to an empty pdf when the part carries no payload at all', () => {
    const block = hubBlockFromResponsesPart({
      type: 'output_file',
      filename: 'report.pdf',
      file_data: '',
    });

    expect(block).toEqual({
      type: 'document',
      source: { type: 'base64', mediaType: 'application/pdf', data: '' },
      filename: 'report.pdf',
    });
  });
});
