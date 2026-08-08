import { describe, expect, test } from 'vitest';

import type { GeminiPart, GeminiRequest } from './gemini-wire';

import { decodeRequest } from './gemini-request-decode';

function fromModel(...parts: GeminiPart[]): GeminiRequest {
  return { contents: [{ role: 'model', parts }] };
}

function fromUser(...parts: GeminiPart[]): GeminiRequest {
  return { contents: [{ role: 'user', parts }] };
}

function blocksOf(request: GeminiRequest): unknown {
  const result = decodeRequest(request);

  return 'value' in result ? result.value.messages[0]?.content : result;
}

describe('decoding a Gemini file reference by its media type', () => {
  test('each media family becomes its own block and an unnamed type becomes a document', () => {
    const request = fromUser(
      { fileData: { mimeType: 'image/png', fileUri: 'https://host/a.png' } },
      { fileData: { mimeType: 'audio/mpeg', fileUri: 'https://host/b.mp3' } },
      { fileData: { mimeType: 'video/mp4', fileUri: 'https://host/c.mp4' } },
      { fileData: { fileUri: 'https://host/d.bin' } },
    );

    expect(blocksOf(request)).toStrictEqual([
      { type: 'image', source: { type: 'url', url: 'https://host/a.png' } },
      { type: 'audio', source: { type: 'url', url: 'https://host/b.mp3' } },
      { type: 'video', source: { type: 'url', url: 'https://host/c.mp4' } },
      {
        type: 'document',
        source: { type: 'url', url: 'https://host/d.bin' },
        filename: 'document',
      },
    ]);
  });
});

describe('decoding Gemini reasoning and tool calls that carry signatures', () => {
  test('a signed thought and a signed argument-free call both keep their signature', () => {
    const request = fromModel(
      { text: 'weighing it up', thought: true, thoughtSignature: 'thought-sig' },
      { functionCall: { name: 'Read', id: 'call_a' }, thoughtSignature: 'call-sig' },
    );

    expect(blocksOf(request)).toStrictEqual([
      { type: 'thinking', text: 'weighing it up', signature: 'thought-sig' },
      { type: 'tool_use', id: 'call_a', name: 'Read', input: {}, signature: 'call-sig' },
    ]);
  });
});

describe('decoding a Gemini tool result the conversation never called for', () => {
  test('a result naming an unseen call keeps the identifier it arrived with', () => {
    const request: GeminiRequest = {
      contents: [
        {
          role: 'function',
          parts: [
            { functionResponse: { name: 'Read', id: 'call_unseen', response: { ok: true } } },
          ],
        },
      ],
    };

    expect(blocksOf(request)).toStrictEqual([
      {
        type: 'tool_result',
        toolUseId: 'call_unseen',
        name: 'Read',
        content: [{ type: 'text', text: '{"ok":true}' }],
        structuredResult: { ok: true },
      },
    ]);
  });
});

describe('decoding a Gemini tool declaration that explains itself', () => {
  test('a described tool carries its description into the request', () => {
    const request: GeminiRequest = {
      ...fromUser({ text: 'hello' }),
      tools: [
        {
          functionDeclarations: [
            { name: 'Read', description: 'reads a file', parameters: { type: 'object' } },
          ],
        },
      ],
    };
    const result = decodeRequest(request);

    expect(result).toHaveProperty('value.tools.0.description', 'reads a file');
  });
});

describe('decoding a Gemini request that says nothing', () => {
  test('turns holding only empty parts are refused as an empty conversation', () => {
    const request = fromUser({ thought: true }, {});

    expect(decodeRequest(request)).toHaveProperty('refusal.reason', 'empty-conversation');
  });
});
