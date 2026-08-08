import { describe, expect, test } from 'vitest';

import { withClaudeContextManagement } from './claude-context';

describe('Claude Code context management', () => {
  test.each([undefined, 'enabled', 'adaptive'])(
    'injects the captured object for thinking type %s',
    (type) => {
      const thinking = type === undefined ? {} : { thinking: { type } };

      expect(withClaudeContextManagement({ model: 'claude-opus-5', ...thinking })).toEqual({
        model: 'claude-opus-5',
        ...thinking,
        context_management: {
          edits: [{ type: 'clear_thinking_20251015', keep: 'all' }],
        },
      });
    },
  );

  test('preserves caller-owned context management', () => {
    const caller = { edits: [{ type: 'caller-owned' }] };

    expect(
      withClaudeContextManagement({ context_management: caller, thinking: { type: 'enabled' } }),
    ).toEqual({ context_management: caller, thinking: { type: 'enabled' } });
  });

  test('does not inject when thinking is disabled', () => {
    expect(withClaudeContextManagement({ thinking: { type: 'disabled' } })).toEqual({
      thinking: { type: 'disabled' },
    });
  });
});
