import { describe, expect, it } from 'vitest';

import { geminiMediaPart } from './gemini-media';

describe('geminiMediaPart: media the caller hosts somewhere else', () => {
  it('points Gemini at the file uri of a hosted image', () => {
    const part = geminiMediaPart({
      type: 'image',
      source: { type: 'url', url: 'https://example.test/cat.png' },
    });

    expect(part).toEqual({ fileData: { fileUri: 'https://example.test/cat.png' } });
  });

  it('carries nothing for a block that holds no media', () => {
    expect(geminiMediaPart({ type: 'text', text: 'hello' })).toBeNull();
  });
});
