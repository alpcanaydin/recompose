import { describe, expect, it } from 'vitest';

import { applyClaudeSystemPolicy } from './claude-system-policy';

const rebuild = { rebuildMidSystemMessages: true };

describe('rebuilding mid-conversation system messages that are not there', () => {
  it('returns the body untouched when no message speaks as the system', () => {
    const body = { system: 'Top rule', messages: [{ role: 'user', content: 'hi' }] };

    expect(applyClaudeSystemPolicy(body, rebuild)).toBe(body);
  });

  it('returns the body untouched when the messages are not a list', () => {
    const body = { system: 'Top rule', messages: 'hi' };

    expect(applyClaudeSystemPolicy(body, rebuild)).toBe(body);
  });
});

describe('rebuilding a system prompt from content the policy cannot read', () => {
  it('drops an existing system prompt that is neither text nor a list', () => {
    const body = {
      system: 42,
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'system', content: 'Mid rule' },
      ],
    };

    expect(applyClaudeSystemPolicy(body, rebuild)).toHaveProperty('system', [
      { type: 'text', text: 'Mid rule' },
    ]);
  });

  it('keeps only the text blocks of a moved system message', () => {
    const body = {
      messages: [
        { role: 'user', content: 'hi' },
        {
          role: 'system',
          content: [
            { type: 'image', source: {} },
            { type: 'text', text: 'Mid rule' },
          ],
        },
      ],
    };

    expect(applyClaudeSystemPolicy(body, rebuild)).toHaveProperty('system', [
      { type: 'text', text: 'Mid rule' },
    ]);
  });
});
