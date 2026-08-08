import { describe, expect, it } from 'vitest';

import { translateRequestToGemini } from './gemini-bridge';

describe('Interactions system instructions crossing Gemini', () => {
  it('should accept the object spelling and preserve its text', () => {
    const translated = translateRequestToGemini('interactions', {
      input: 'hi',
      system_instruction: { text: 'be brief' },
    });

    expect(translated).toHaveProperty('value.systemInstruction.parts.0.text', 'be brief');
  });
});

describe('Interactions document URIs crossing Gemini', () => {
  it('should preserve a model-output file URI as Gemini file data', () => {
    const translated = translateRequestToGemini('interactions', {
      input: [
        {
          type: 'model_output',
          content: [
            {
              type: 'document',
              mime_type: 'application/pdf',
              file_uri: 'gs://bucket/doc.pdf',
            },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty('value.contents.0.role', 'model');
    expect(translated).toHaveProperty('value.contents.0.parts.0.fileData', {
      fileUri: 'gs://bucket/doc.pdf',
    });
  });
});

describe('Interactions thought media crossing Gemini', () => {
  it('should retain thought text and audio content together', () => {
    const translated = translateRequestToGemini('interactions', {
      input: [
        {
          type: 'thought',
          content: [
            { type: 'text', text: 'thinking' },
            { type: 'audio', mime_type: 'audio/wav', data: 'UklGRg==' },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty('value.contents.0.parts.0', {
      text: 'thinking',
      thought: true,
    });
    expect(translated).toHaveProperty('value.contents.0.parts.1.inlineData', {
      mimeType: 'audio/wav',
      data: 'UklGRg==',
    });
  });
});

describe('Interactions parent turn roles crossing Gemini', () => {
  it('should keep every step in a model turn under the model role', () => {
    const translated = translateRequestToGemini('interactions', {
      input: {
        role: 'model',
        steps: [
          { type: 'user_input', content: [{ type: 'text', text: 'hi' }] },
          { type: 'model_output', content: [{ type: 'text', text: 'ok' }] },
        ],
      },
    });

    expect(translated).toHaveProperty('value.contents.0.role', 'model');
    expect(translated).toHaveProperty('value.contents.1.role', 'model');
  });
});
