import { describe, expect, it } from 'vitest';

import { normalizeOpenAIFileData } from './openai-file-data';

describe('OpenAI file-data normalization', () => {
  it.each([
    ['data URL', 'test.pdf', undefined, 'data:application/pdf;base64,JVBERi0xLjQK'],
    [
      'metadata and MIME override',
      'test.txt',
      undefined,
      'data:application/pdf;charset=binary;BASE64,JVBERi0xLjQK',
    ],
    ['case-insensitive scheme', 'test.pdf', undefined, 'DATA:application/pdf;base64,JVBERi0xLjQK'],
    ['raw base64 from extension', 'TEST.PDF', undefined, 'JVBERi0xLjQK'],
    ['raw base64 from fallback', '', 'application/pdf', 'JVBERi0xLjQK'],
  ])('should normalize %s', (_name, filename, fallback, fileData) => {
    expect(normalizeOpenAIFileData(filename, fallback, fileData)).toEqual({
      mediaType: 'application/pdf',
      data: 'JVBERi0xLjQK',
    });
  });

  it.each([
    ['empty data', 'test.pdf', undefined, ''],
    ['unknown raw extension', 'test', undefined, 'JVBERi0xLjQK'],
    ['missing base64 marker', 'test.pdf', undefined, 'data:application/pdf,JVBERi0xLjQK'],
    ['missing MIME type', 'test.pdf', undefined, 'data:;base64,JVBERi0xLjQK'],
    ['missing payload', 'test.pdf', undefined, 'data:application/pdf;base64,'],
  ])('should reject %s', (_name, filename, fallback, fileData) => {
    expect(normalizeOpenAIFileData(filename, fallback, fileData)).toBeNull();
  });
});
