import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ClaudePayloadPolicy } from './claude-payload-policy';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { applyClaudePayloadFinalPolicy } from './claude-payload-policy';
import { claudeProviderRequest } from './claude-request';

describe('Claude configured cloaking policy parity', () => {
  it('TestApplyCloaking_PreservesConfiguredStrictModeAndSensitiveWordsWhenModeOmitted', () => {
    const body = prepared(
      {
        model: 'claude-opus-5',
        system: 'proxy rules',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'proxy access' }] }],
      },
      { strictMode: true, sensitiveWords: ['proxy'] },
    );

    expect(body).toHaveProperty('system.0.text', expect.stringContaining('billing-header'));
    expect(JSON.stringify(body['system'])).not.toContain('proxy rules');
    expect(body).toHaveProperty('messages.0.content.1.text', expect.stringContaining('\u200B'));
  });
});

describe('Claude payload thinking override parity', () => {
  it('TestClaudeExecutorPayloadOverrideDisabledThinking', () => {
    const body = prepared(baseBody(), override({ 'thinking.type': 'disabled' }));
    const caller = prepared(
      { ...baseBody(), context_management: { edits: [{ type: 'caller_owned' }] } },
      override({ 'thinking.type': 'disabled' }),
    );

    expect(body).toHaveProperty('thinking.type', 'disabled');
    expect(body).not.toHaveProperty('context_management');
    expect(caller).toHaveProperty('context_management.edits.0.type', 'caller_owned');
  });

  it('TestClaudeExecutorPayloadOverrideReenablesThinking', () => {
    const enabled = prepared(
      { ...baseBody(), thinking: { type: 'disabled' } },
      override({ 'thinking.type': 'enabled' }),
    );
    const custom = prepared(
      baseBody(),
      override({
        'thinking.type': 'adaptive',
        context_management: { edits: [{ type: 'payload_rule' }] },
      }),
    );
    const filtered = prepared(baseBody(), {
      ...override({ 'thinking.type': 'enabled' }),
      filters: [{ models: ['claude-opus-5'], paths: ['context_management'] }],
    });

    expect(enabled).toHaveProperty('thinking.type', 'enabled');
    expect(enabled).toHaveProperty('context_management.edits.0.type', 'clear_thinking_20251015');
    expect(custom).toHaveProperty('context_management.edits.0.type', 'payload_rule');
    expect(filtered).toHaveProperty('thinking.type', 'enabled');
    expect(filtered).not.toHaveProperty('context_management');
  });
});

describe('Claude thinking signatures through cloaking parity', () => {
  it('TestClaudeThinkingSignaturesSurviveUpstreamPreparation', () => {
    const signature = classicSignature();
    const body = prepared(thinkingBody(signature, 'first question'), {
      sensitiveWords: [],
    });

    expect(thinkingSignatures(body)).toEqual([signature]);
  });

  it('TestClaudeThinkingSignaturesSurviveSensitiveWordObfuscation', () => {
    const signature = 'ErUBCkYIBRgCproxyKkDq+9zN==';
    const body = applyClaudePayloadFinalPolicy(
      thinkingBody(signature, 'please use the proxy now'),
      {
        sensitiveWords: ['proxy'],
      },
    );

    expect(body).toHaveProperty('messages.0.content.0.text', expect.stringContaining('\u200B'));
    expect(thinkingSignatures(body)).toEqual([signature]);
  });
});

function prepared(body: JsonObject, policy: ClaudePayloadPolicy): JsonObject {
  const request = claudeProviderRequest(
    'https://api.anthropic.com',
    body,
    'token',
    { sessionId: 'session', requestId: 'request' },
    undefined,
    Date.UTC(2026, 7, 7),
    'messages',
    undefined,
    undefined,
    policy,
  );
  const parsed = parsedJson(request.body);

  if (!isJsonObject(parsed)) throw new Error('expected Claude body');

  return parsed;
}

function baseBody(): JsonObject {
  return {
    model: 'claude-opus-5',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'hi' }],
  };
}

function override(values: JsonObject): ClaudePayloadPolicy {
  return { overrides: [{ models: ['claude-opus-5'], values }] };
}

function classicSignature(): string {
  const channel = Buffer.from([0x08, 0x0c]);
  const container = Buffer.concat([Buffer.from([0x0a, channel.length]), channel]);
  const payload = Buffer.concat([Buffer.from([0x12, container.length]), container]);

  return payload.toString('base64');
}

function thinkingBody(signature: string, text: string): JsonObject {
  return {
    model: 'claude-opus-5',
    messages: [
      { role: 'user', content: [{ type: 'text', text }] },
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'reason', signature }],
      },
    ],
  };
}

function thinkingSignatures(body: JsonObject): string[] {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];

  return messages.flatMap((message) => {
    if (!isJsonObject(message) || !Array.isArray(message['content'])) return [];

    return message['content'].flatMap((block) =>
      isJsonObject(block) && block['type'] === 'thinking' && typeof block['signature'] === 'string'
        ? [block['signature']]
        : [],
    );
  });
}
