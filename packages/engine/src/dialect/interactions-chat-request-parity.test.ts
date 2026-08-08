import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Chat file data crossing Interactions', () => {
  it('should normalize a file data URL into raw document bytes', () => {
    const translated = translateRequest('chat-completions', 'interactions', {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'test.pdf',
                file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
              },
            },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.content.0', {
      type: 'file',
      mime_type: 'application/pdf',
      data: 'JVBERi0xLjQK',
      name: 'test.pdf',
    });
  });

  it('should preserve an already raw document payload', () => {
    const translated = translateRequest('chat-completions', 'interactions', {
      messages: [
        {
          role: 'user',
          content: [{ type: 'document', mime_type: 'application/pdf', data: 'JVBERi0xLjQK' }],
        },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.content.0', {
      type: 'file',
      mime_type: 'application/pdf',
      data: 'JVBERi0xLjQK',
      name: 'document',
    });
  });
});
