import { describe, expect, test } from 'vitest';

import { chatSystemTexts } from './chat-completions-system-content';

describe('reading the system prompt a chat request carries', () => {
  test('a plain string system prompt stands alone', () => {
    expect(chatSystemTexts('be terse')).toEqual(['be terse']);
  });

  test('structured system parts contribute their text in order', () => {
    expect(
      chatSystemTexts([
        { type: 'text', text: 'be terse' },
        { type: 'text', text: 'answer in English' },
      ]),
    ).toEqual(['be terse', 'answer in English']);
  });

  test('a system part that carries no text contributes nothing', () => {
    expect(
      chatSystemTexts([
        { type: 'image_url', image_url: { url: 'https://example.test/logo.png' } },
        { type: 'text', text: 'be terse' },
      ]),
    ).toEqual(['be terse']);
  });
});
