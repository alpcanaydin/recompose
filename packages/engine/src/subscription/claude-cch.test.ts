import { describe, expect, test } from 'vitest';

import { signedClaudeBody } from './claude-cch';

const base = {
  model: 'model-a',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
  system: [
    {
      type: 'text',
      text: 'x-anthropic-billing-header: cc_version=2.1.220.test; cc_entrypoint=sdk-cli; cch=00000;',
    },
    { type: 'text', text: 'system-x' },
  ],
  tools: [],
  metadata: { user_id: 'meta-x' },
  max_tokens: 1,
  thinking: { type: 'adaptive', display: 'omitted' },
  context_management: { edits: [{ type: 'clear_thinking_20251015', keep: 'all' }] },
  output_config: { effort: 'high' },
  stream: true,
};

function cchOf(body: Record<string, unknown>): string {
  const match = / cch=([a-f\d]{5});/u.exec(signedClaudeBody(body));

  return match?.[1] ?? '';
}

describe('Claude Code 2.1.220 CCH signing', () => {
  test('matches upstream known vectors', () => {
    expect(cchOf(base)).toBe('7ee87');
    expect(cchOf({ ...base, model: 'model-b' })).toBe('7ee87');
    expect(cchOf({ ...base, max_tokens: 2 })).toBe('7ee87');
    expect(
      cchOf({ ...base, messages: [{ role: 'user', content: [{ type: 'text', text: 'y' }] }] }),
    ).toBe('b9cc8');
    expect(cchOf({ ...base, metadata: { user_id: 'meta-y' } })).toBe('7a89d');
    expect(cchOf({ ...base, stream: false })).toBe('60400');
  });

  test('adds a signed billing block and Claude Code identity without dropping caller system', () => {
    const body: unknown = JSON.parse(
      signedClaudeBody({ messages: [{ role: 'user', content: 'hello' }], system: 'caller' }),
    );

    const serialized = JSON.stringify(body);

    expect(serialized).toMatch(/x-anthropic-billing-header:.*cch=[a-f\d]{5};/u);
    expect(serialized).toContain(CLAUDE_CODE_IDENTITY_FOR_TEST);
    expect(serialized).toContain('"text":"caller"');
  });
});

const CLAUDE_CODE_IDENTITY_FOR_TEST = "You are Claude Code, Anthropic's official CLI for Claude.";
