import { describe, expect, test } from 'vitest';

import { geminiPayload } from './gateway-gemini-ingress';

describe('recognizing a request as Gemini-shaped', () => {
  test('a body that carries no conversation is not a Gemini request', () => {
    expect(geminiPayload({ model: 'gemini-3-pro' })).toBeNull();
  });

  test('a body whose conversation is not a list is not a Gemini request', () => {
    expect(geminiPayload({ contents: 'hello' })).toBeNull();
  });
});

describe('normalizing conversation entries that are not shaped as turns', () => {
  test('entries and parts the schema does not describe survive untouched', () => {
    const payload = geminiPayload({
      contents: [
        'not-a-turn',
        { role: 'user' },
        { role: 'user', parts: ['not-a-part', { function_call: { name: 'Read', args: {} } }] },
      ],
    });

    expect(payload).toHaveProperty('contents.0', 'not-a-turn');
    expect(payload).toHaveProperty('contents.1', { role: 'user' });
    expect(payload).toHaveProperty('contents.2.parts.0', 'not-a-part');
    expect(payload).toHaveProperty('contents.2.parts.1.functionCall', { name: 'Read', args: {} });
  });
});

describe('normalizing the tools a Gemini caller declares', () => {
  test('a tool entry that is not an object and one declaring nothing both survive', () => {
    const payload = geminiPayload({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      tools: ['not-a-tool', { googleSearch: {} }],
    });

    expect(payload).toHaveProperty('tools.0', 'not-a-tool');
    expect(payload).toHaveProperty('tools.1', { googleSearch: {} });
  });
});

describe('normalizing the tool config a Gemini caller sends', () => {
  test('a tool config naming no calling config is carried through as it stands', () => {
    const payload = geminiPayload({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      tool_config: { retrievalConfig: { latLng: { latitude: 1, longitude: 2 } } },
    });

    expect(payload).toHaveProperty('toolConfig', {
      retrievalConfig: { latLng: { latitude: 1, longitude: 2 } },
    });
  });

  test('a calling config restricting nothing keeps its mode and gains no allow list', () => {
    const payload = geminiPayload({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      toolConfig: { function_calling_config: { mode: 'AUTO' } },
    });

    expect(payload).toHaveProperty('toolConfig.functionCallingConfig', { mode: 'AUTO' });
  });
});
