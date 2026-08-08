import { describe, expect, it } from 'vitest';

import { parsedJson } from '../gateway-wire';
import { claudeCountTokensProviderRequest } from './claude-count-tokens';
import { claudeProviderRequest } from './claude-request';
import {
  applyClaudeSystemPolicy,
  ClaudeCallerSystemError,
  validateClaudeCallerSystem,
} from './claude-system-policy';

describe('Claude caller system validation parity', () => {
  it('TestValidateClaudeCallerSystemBlocksAcceptsTextOnly', () => {
    expect(() => {
      validateClaudeCallerSystem('S1');
    }).not.toThrow();
    expect(() => {
      validateClaudeCallerSystem([{ type: 'text', text: 'S1' }]);
    }).not.toThrow();
    expect(() => {
      validateClaudeCallerSystem(undefined);
    }).not.toThrow();
  });

  it('TestValidateClaudeCallerSystemBlocksRejectsNonTextBlock', () => {
    const cases: readonly [number, Record<string, unknown>, string][] = [
      [1, { type: 'image' }, 'image'],
      [0, { type: 'input_file' }, 'input_file'],
      [0, { text: 'S1' }, 'unknown'],
    ];

    for (const [index, block, type] of cases) {
      const system = index === 1 ? [{ type: 'text', text: 'S1' }, block] : [block];

      expect(() => {
        validateClaudeCallerSystem(system);
      }).toThrow(`system.${String(index)}.type: Input should be 'text'`);
      expect(() => {
        validateClaudeCallerSystem(system);
      }).toThrow(JSON.stringify(type));
    }
  });
});

describe('Claude mid-system rebuild parity', () => {
  it('TestClaudeExecutor_RebuildMidSystemMessageDisabledByDefault', () => {
    const body = fixture();

    expect(applyClaudeSystemPolicy(body, undefined)).toBe(body);
    expect(body).toHaveProperty('messages.1.role', 'system');
  });

  it('TestClaudeExecutor_RebuildMidSystemMessageOptInMovesSystemMessages', () => {
    const rebuilt = applyClaudeSystemPolicy(fixture(), { rebuildMidSystemMessages: true });

    expect(rebuilt).toHaveProperty('system', [
      { type: 'text', text: 'Top rule' },
      { type: 'text', text: 'Mid string rule' },
      { type: 'text', text: 'Mid array rule', cache_control: { type: 'ephemeral' } },
    ]);
    expect(JSON.stringify(rebuilt)).not.toContain('"role":"system"');
  });
});

describe('Claude strict and count-token system policy parity', () => {
  it('TestApplyCloakingRejectsNonTextCallerSystemBlock', () => {
    expect(() => prepared({ validateCallerSystem: true })).toThrow(ClaudeCallerSystemError);
  });

  it('TestApplyCloakingStrictModeIgnoresNonTextCallerSystemBlock', () => {
    expect(() => prepared({ validateCallerSystem: true, strictMode: true })).not.toThrow();
  });

  it('TestClaudeExecutor_CountTokensRejectsNonTextCallerSystemBlock', () => {
    expect(() =>
      claudeCountTokensProviderRequest(
        'https://api.anthropic.com',
        invalidSystemBody(),
        'token',
        { sessionId: 'session', requestId: 'request' },
        { validateCallerSystem: true },
      ),
    ).toThrow(ClaudeCallerSystemError);
  });
});

function fixture() {
  return {
    system: 'Top rule',
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'system', content: 'Mid string rule' },
      { role: 'assistant', content: 'ok' },
      {
        role: 'system',
        content: [{ type: 'text', text: 'Mid array rule', cache_control: { type: 'ephemeral' } }],
      },
    ],
  };
}

function invalidSystemBody() {
  return {
    model: 'claude-opus-5',
    system: [{ type: 'text', text: 'S1' }, { type: 'input_image' }],
    messages: [{ role: 'user', content: 'U1' }],
  };
}

function prepared(policy: Parameters<typeof applyClaudeSystemPolicy>[1]) {
  return parsedJson(
    claudeProviderRequest(
      'https://api.anthropic.com',
      invalidSystemBody(),
      'token',
      { sessionId: 'session', requestId: 'request' },
      undefined,
      Date.UTC(2026, 7, 7),
      'messages',
      undefined,
      policy,
    ).body,
  );
}
