import { describe, expect, it } from 'vitest';

import {
  hubBlocksFromInteractionsContent,
  interactionsImagePart,
  interactionsPartFromHubMedia,
  interactionsText,
  interactionsToolCall,
  isHubInteractionsMedia,
} from './interactions-content';

describe('Interactions text flattening', () => {
  it('should return a plain string unchanged', () => {
    expect(interactionsText('already flat')).toBe('already flat');
  });

  it('should read absent content as empty text', () => {
    expect(interactionsText(undefined)).toBe('');
  });

  it('should join the text parts and skip the media parts', () => {
    const flattened = interactionsText([
      { type: 'text', text: 'before ' },
      { type: 'image', uri: 'https://example.test/cat.png' },
      { type: 'text', text: 'after' },
    ]);

    expect(flattened).toBe('before after');
  });
});

describe('Interactions image content', () => {
  it('should keep a remote image as a URL source', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'image', uri: 'https://example.test/cat.png' },
    ]);

    expect(blocks).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://example.test/cat.png' } },
    ]);
  });

  it('should assume PNG bytes when the image part names no media type', () => {
    const blocks = hubBlocksFromInteractionsContent([{ type: 'image', data: 'aGk=' }]);

    expect(blocks).toEqual([
      { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'aGk=' } },
    ]);
  });

  it('should drop an image part that carries neither a location nor bytes', () => {
    expect(hubBlocksFromInteractionsContent([{ type: 'image' }])).toEqual([]);
  });
});

describe('Interactions document content', () => {
  it('should keep a hosted document as a URL source under its given name', () => {
    const blocks = hubBlocksFromInteractionsContent([
      {
        type: 'document',
        mime_type: 'application/pdf',
        file_uri: 'https://example.test/brief.pdf',
        name: 'brief.pdf',
      },
    ]);

    expect(blocks).toEqual([
      {
        type: 'document',
        source: { type: 'url', url: 'https://example.test/brief.pdf' },
        filename: 'brief.pdf',
      },
    ]);
  });

  it('should name an unnamed document "document"', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'document', mime_type: 'application/pdf', data: 'JVBERi0=' },
    ]);

    expect(blocks).toEqual([
      {
        type: 'document',
        source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
        filename: 'document',
      },
    ]);
  });

  it('should drop a document part that carries neither a location nor bytes', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'document', mime_type: 'application/pdf' },
    ]);

    expect(blocks).toEqual([]);
  });
});

describe('Interactions file content', () => {
  it('should treat flat file bytes without a media type as opaque octets', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'file', data: 'AAEC', name: 'payload.bin' },
    ]);

    expect(blocks).toEqual([
      {
        type: 'document',
        source: { type: 'base64', mediaType: 'application/octet-stream', data: 'AAEC' },
        filename: 'payload.bin',
      },
    ]);
  });

  it('should honour the media type declared beside flat file bytes', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'file', data: 'JVBERi0=', mime_type: 'application/pdf' },
    ]);

    expect(blocks).toEqual([
      {
        type: 'document',
        source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
        filename: 'document',
      },
    ]);
  });
});

describe('Interactions nested file content', () => {
  it('should prefer the nested filename over the outer name', () => {
    const blocks = hubBlocksFromInteractionsContent([
      {
        type: 'file',
        name: 'outer.pdf',
        file: { filename: 'nested.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
      },
    ]);

    expect(blocks).toHaveProperty('0.filename', 'nested.pdf');
  });

  it('should fall back to the outer name when resolving nested file bytes', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'file', name: 'outer.pdf', file: { file_data: 'JVBERi0=' }, mime_type: 'text/plain' },
    ]);

    expect(blocks).toEqual([
      {
        type: 'document',
        source: { type: 'base64', mediaType: 'text/plain', data: 'JVBERi0=' },
        filename: 'outer.pdf',
      },
    ]);
  });

  it('should drop a file part whose nested and flat bytes are both unusable', () => {
    expect(hubBlocksFromInteractionsContent([{ type: 'file', file: { file_data: '' } }])).toEqual(
      [],
    );
  });

  it('should drop a file part that carries no bytes at all', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'file', uri: 'https://example.test/a' },
    ]);

    expect(blocks).toEqual([]);
  });
});

describe('Interactions media and text content', () => {
  it('should carry audio bytes through as an audio block', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'audio', data: 'QUJD', mime_type: 'audio/wav' },
    ]);

    expect(blocks).toEqual([
      { type: 'audio', source: { type: 'base64', mediaType: 'audio/wav', data: 'QUJD' } },
    ]);
  });

  it('should carry video bytes through as a video block', () => {
    const blocks = hubBlocksFromInteractionsContent([
      { type: 'video', data: 'QUJD', mime_type: 'video/mp4' },
    ]);

    expect(blocks).toHaveProperty('0.type', 'video');
  });

  it('should read whole-string content as a single text block', () => {
    expect(hubBlocksFromInteractionsContent('hello')).toEqual([{ type: 'text', text: 'hello' }]);
  });
});

describe('Hub media recognition', () => {
  it('should recognize media blocks and reject text blocks', () => {
    const recognized = [
      isHubInteractionsMedia({ type: 'image', source: { type: 'url', url: 'https://a.test/b' } }),
      isHubInteractionsMedia({ type: 'text', text: 'plain' }),
    ];

    expect(recognized).toEqual([true, false]);
  });
});

describe('Hub media to Interactions parts', () => {
  it('should render a hosted image as a URI part', () => {
    expect(interactionsImagePart({ type: 'url', url: 'https://example.test/cat.png' })).toEqual({
      type: 'image',
      uri: 'https://example.test/cat.png',
    });
  });

  it('should render image bytes as a data part', () => {
    const part = interactionsPartFromHubMedia({
      type: 'image',
      source: { type: 'base64', mediaType: 'image/png', data: 'aGk=' },
    });

    expect(part).toEqual({ type: 'image', data: 'aGk=', mime_type: 'image/png' });
  });

  it('should render a hosted document as a named file URI part', () => {
    const part = interactionsPartFromHubMedia({
      type: 'document',
      source: { type: 'url', url: 'https://example.test/brief.pdf' },
      filename: 'brief.pdf',
    });

    expect(part).toEqual({
      type: 'file',
      uri: 'https://example.test/brief.pdf',
      name: 'brief.pdf',
    });
  });

  it('should render document bytes as a named file data part', () => {
    const part = interactionsPartFromHubMedia({
      type: 'document',
      source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
      filename: 'brief.pdf',
    });

    expect(part).toEqual({
      type: 'file',
      data: 'JVBERi0=',
      mime_type: 'application/pdf',
      name: 'brief.pdf',
    });
  });

  it('should refuse a hosted audio block that Interactions cannot address by URL', () => {
    const part = interactionsPartFromHubMedia({
      type: 'audio',
      source: { type: 'url', url: 'https://example.test/clip.wav' },
    });

    expect(part).toBeNull();
  });
});

describe('Hub tool call to an Interactions step', () => {
  it('should carry the signature when the tool call was signed', () => {
    const step = interactionsToolCall({
      type: 'tool_use',
      id: 'call_1',
      name: 'lookup',
      input: { city: 'Ankara' },
      signature: 'sig-1',
    });

    expect(step).toEqual({
      type: 'function_call',
      id: 'call_1',
      call_id: 'call_1',
      name: 'lookup',
      arguments: { city: 'Ankara' },
      signature: 'sig-1',
    });
  });

  it('should omit the signature when the tool call was unsigned', () => {
    const step = interactionsToolCall({
      type: 'tool_use',
      id: 'call_2',
      name: 'lookup',
      input: {},
    });

    expect(step).not.toHaveProperty('signature');
  });
});
