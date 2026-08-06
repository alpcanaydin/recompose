import { describe, expect, test } from 'vitest';

import type { HubRequest } from './hub';

import { encodeRequest } from './gemini-request';

const hub: HubRequest = {
  system: [{ text: 'Be terse.' }],
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    {
      role: 'assistant',
      content: [
        { type: 'thinking', text: 'reason', signature: 'sig' },
        { type: 'tool_use', id: 'call_1', name: 'weather', input: { city: 'Istanbul' } },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'call_1',
          content: [{ type: 'text', text: 'sunny' }],
        },
      ],
    },
  ],
  tools: [
    {
      name: 'weather',
      description: 'Read weather',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    },
  ],
  toolChoice: { type: 'tool', name: 'weather' },
  sampling: { maxOutputTokens: 1024, temperature: 0.2, topP: 0.9, stop: ['done'] },
};

const expectedContents = [
  { role: 'user', parts: [{ text: 'hello' }] },
  {
    role: 'model',
    parts: [
      { text: 'reason', thought: true, thoughtSignature: 'sig' },
      { functionCall: { name: 'weather', args: { city: 'Istanbul' }, id: 'call_1' } },
    ],
  },
  {
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: 'call_1',
          id: 'call_1',
          response: { output: 'sunny' },
        },
      },
    ],
  },
];

describe('Gemini request encoding', () => {
  test('maps conversation, tools, thinking, and sampling to generateContent', () => {
    const translated = encodeRequest(hub);

    expect(translated.value).toMatchObject({
      systemInstruction: { role: 'user', parts: [{ text: 'Be terse.' }] },
      contents: expectedContents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
        topP: 0.9,
        stopSequences: ['done'],
      },
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['weather'] },
      },
    });
    expect(translated.value.tools?.[0]?.functionDeclarations[0]).toEqual({
      name: 'weather',
      description: 'Read weather',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    });
  });
});
