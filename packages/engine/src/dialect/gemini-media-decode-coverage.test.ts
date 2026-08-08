import { describe, expect, test } from 'vitest';

import { geminiMediaBlock } from './gemini-media-decode';

describe('Gemini inline media decoding', () => {
  test('inline picture bytes become an image block', () => {
    const block = geminiMediaBlock({ inlineData: { mimeType: 'image/png', data: 'AAAA' } });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'base64', mediaType: 'image/png', data: 'AAAA' },
    });
  });

  test('inline sound bytes become an audio block', () => {
    const block = geminiMediaBlock({ inlineData: { mimeType: 'audio/mpeg', data: 'BBBB' } });

    expect(block).toEqual({
      type: 'audio',
      source: { type: 'base64', mediaType: 'audio/mpeg', data: 'BBBB' },
    });
  });

  test('inline moving pictures become a video block', () => {
    const block = geminiMediaBlock({ inlineData: { mimeType: 'video/mp4', data: 'CCCC' } });

    expect(block).toEqual({
      type: 'video',
      source: { type: 'base64', mediaType: 'video/mp4', data: 'CCCC' },
    });
  });

  test('inline bytes of any other kind become a named document block', () => {
    const block = geminiMediaBlock({ inlineData: { mimeType: 'application/pdf', data: 'DDDD' } });

    expect(block).toEqual({
      type: 'document',
      source: { type: 'base64', mediaType: 'application/pdf', data: 'DDDD' },
      filename: 'document',
    });
  });
});

describe('Gemini referenced media decoding', () => {
  test('a referenced picture keeps its address as the source', () => {
    const block = geminiMediaBlock({
      fileData: { mimeType: 'image/jpeg', fileUri: 'https://files.example/photo.jpg' },
    });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://files.example/photo.jpg' },
    });
  });

  test('a referenced file without a declared type is read as a picture', () => {
    const block = geminiMediaBlock({ fileData: { fileUri: 'https://files.example/unknown' } });

    expect(block).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://files.example/unknown' },
    });
  });

  test('a referenced document cannot be carried and is dropped', () => {
    const block = geminiMediaBlock({
      fileData: { mimeType: 'application/pdf', fileUri: 'https://files.example/report.pdf' },
    });

    expect(block).toBeNull();
  });

  test('a part that carries no media at all is dropped', () => {
    expect(geminiMediaBlock({ text: 'plain answer' })).toBeNull();
  });
});
