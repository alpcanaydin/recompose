import { describe, expect, it } from 'vitest';

import { nativeSignature } from '../subscription/antigravity-replay.testkit';
import { restoreGeminiClaudeCarriersV2 } from './gemini-claude-carrier-restore';

describe('restoring Gemini carriers on a Claude assistant turn', () => {
  it('should stop the carrier scan at a block that carries no meaning', () => {
    const signature = nativeSignature();
    const result = { type: 'tool_result', toolUseId: 'call-1', content: [] } as const;

    const restored = restoreGeminiClaudeCarriersV2({
      role: 'assistant',
      content: [{ type: 'thinking', text: '', signature }, result],
    });

    expect(restored.content).toEqual([{ type: 'thinking', text: '', signature }, result]);
  });
});
