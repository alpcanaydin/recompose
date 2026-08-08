import { describe, expect, it } from 'vitest';

import { hubBlockFromResponsesPart } from './responses-media-decode';

describe('a Responses text part that marks a cache breakpoint', () => {
  it('should carry the lifetime the caller asks the cache to hold', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_text',
      text: 'hello',
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });

    expect(block).toEqual({
      type: 'text',
      text: 'hello',
      cacheBreakpoint: { type: 'ephemeral', ttl: '1h' },
    });
  });

  it('should leave the lifetime to the provider when the caller names none', () => {
    const block = hubBlockFromResponsesPart({
      type: 'output_text',
      text: 'hello',
      cache_control: { type: 'ephemeral' },
    });

    expect(block).toEqual({ type: 'text', text: 'hello', cacheBreakpoint: { type: 'ephemeral' } });
  });
});

describe('a Responses image part', () => {
  it('should read the original detail request as the highest detail', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/a.png',
      detail: 'original',
    });

    expect(block).toHaveProperty('detail', 'high');
  });

  it('should keep a detail the Responses dialect already names', () => {
    const low = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/a.png',
      detail: 'low',
    });
    const automatic = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/a.png',
      detail: 'auto',
    });

    expect(low).toHaveProperty('detail', 'low');
    expect(automatic).toHaveProperty('detail', 'auto');
  });

  it('should leave the detail unstated when the caller names one it cannot read', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_image',
      image_url: 'https://example.test/a.png',
      detail: 'ultra',
    });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://example.test/a.png' },
    });
  });
});

describe('a Responses audio part', () => {
  it('should carry the recording under the format the caller states', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_audio',
      input_audio: { data: 'AAAA', format: 'wav' },
    });

    expect(block).toEqual({
      type: 'audio',
      source: { type: 'base64', mediaType: 'audio/wav', data: 'AAAA' },
    });
  });
});

describe('a Responses file part', () => {
  it('should read the media type a data URL declares', () => {
    const block = hubBlockFromResponsesPart({
      type: 'input_file',
      filename: 'notes.txt',
      file_data: 'data:text/plain;base64,aGk=',
    });

    expect(block).toEqual({
      type: 'document',
      source: { type: 'base64', mediaType: 'text/plain', data: 'aGk=' },
      filename: 'notes.txt',
    });
  });

  it('should treat a file with no content as an empty document', () => {
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
