import { describe, expect, it } from 'vitest';

import { decodeRequest } from './chat-completions-codec';
import { aChatRequest } from './chat-completions.testkit';

describe('a chat request naming a tool it never declared', () => {
  it('carries the named choice as a plain function tool', () => {
    const decoded = decodeRequest(
      aChatRequest({ tool_choice: { type: 'function', function: { name: 'lookup' } } }),
    );

    if ('refusal' in decoded) throw new Error('the chat request was refused');

    expect(decoded.value.toolChoice).toEqual({ type: 'tool', name: 'lookup' });
  });
});
