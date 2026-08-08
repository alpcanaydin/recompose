import { describe, expect, it } from 'vitest';

import { geminiClaudeToolUseId, isGeminiClaudeToolUseId } from './gemini-tool-provenance';

describe('minting a stable Claude tool-use id from a Gemini call', () => {
  it.each([
    { id: '   ', name: 'Bash' },
    { id: 'call-1', name: '  ' },
  ])('should mint nothing when the call is missing $id or $name', ({ id, name }) => {
    expect(geminiClaudeToolUseId(id, name, { command: 'true' })).toBe('');
  });

  it('should mint a recognizable id when the call names both parts', () => {
    const minted = geminiClaudeToolUseId('call-1', 'Bash', { command: 'true' });

    expect(isGeminiClaudeToolUseId(minted)).toBe(true);
  });
});
