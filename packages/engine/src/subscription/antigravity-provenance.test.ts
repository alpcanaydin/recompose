import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';

import { translateResponseFromGemini } from '../dialect/gemini-bridge';
import { geminiClaudeToolUseId, isGeminiClaudeToolUseId } from '../dialect/gemini-tool-provenance';
import { parsedJson } from '../gateway-wire';
import { AntigravityReasoningReplay, antigravityReplayKey } from './antigravity-replay';
import { nativeSignature } from './antigravity-replay.testkit';
import { antigravityProviderRequest } from './antigravity-request';

function tool(name: string, defaults: JsonObject = {}): JsonObject {
  return {
    functionDeclarations: [
      {
        name,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(defaults).map(([key, value]) => [
              key,
              { type: 'boolean', default: value },
            ]),
          ),
        },
      },
    ],
  };
}

function history(id: string, name: string, args: JsonObject, responseName = name): JsonObject {
  return {
    model: 'gemini-3.6-flash-high',
    tools: [tool(name, { replace_all: false })],
    contents: [
      {
        role: 'model',
        parts: [
          {
            functionCall: { id, name, args },
            thoughtSignature: 'skip_thought_signature_validator',
          },
        ],
      },
      {
        role: 'user',
        parts: [{ functionResponse: { id, name: responseName, response: { result: 'ok' } } }],
      },
    ],
  };
}

function replayed(body: JsonObject, items: AntigravityReplayItem[]): JsonObject {
  const replay = new AntigravityReasoningReplay();
  const key = antigravityReplayKey('account-1', body, 'session-1');

  replay.commit(key, items);

  return replay.inject(key, body);
}

describe('Claude-facing Gemini tool provenance', () => {
  test('emits a stable opaque ID from native Gemini responses', () => {
    const args = { path: '/tmp/a' };
    const translated = translateResponseFromGemini('anthropic', {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ functionCall: { id: 'native-1', name: 'Read', args } }],
          },
          finishReason: 'STOP',
        },
      ],
    });
    const expected = 'cpa_gemini_6bbf3453faa8c721ed0256348b6b195b';

    expect(geminiClaudeToolUseId('native-1', 'Read', args)).toBe(expected);
    expect(translated).toHaveProperty('value.content.0.id', expected);
    expect(isGeminiClaudeToolUseId(expected)).toBe(true);
  });

  test('restores native identity and drops a client-inserted schema default', () => {
    const nativeArgs = { file_path: '/tmp/a' };
    const item = {
      id: 'native-edit',
      name: 'Edit',
      args: nativeArgs,
      signature: nativeSignature(),
    };
    const stable = geminiClaudeToolUseId(item.id, item.name, item.args);
    const restored = replayed(history(stable, 'Edit', { ...nativeArgs, replace_all: false }), [
      item,
    ]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-edit');
    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.args', nativeArgs);
    expect(restored).toHaveProperty('contents.0.parts.0.thoughtSignature', item.signature);
    expect(restored).toHaveProperty('contents.1.parts.0.functionResponse.id', 'native-edit');
  });

  test('restores legacy Claude tool IDs when name and semantic args still match', () => {
    const item = { id: 'native-legacy', name: 'Edit', args: { file_path: '/tmp/a' } };
    const restored = replayed(
      history('Edit-legacy-client-id', 'Edit', { file_path: '/tmp/a', replace_all: false }),
      [item],
    );

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-legacy');
    expect(restored).toHaveProperty('contents.1.parts.0.functionResponse.id', 'native-legacy');
  });
});

describe('invalid Claude-facing Gemini provenance', () => {
  test('degrades reserved IDs when provenance is missing', () => {
    const stable = geminiClaudeToolUseId('missing-native', 'Read', { file_path: '/tmp/a' });
    const restored = replayed(history(stable, 'Read', { file_path: '/tmp/a' }), []);
    const callId = restored['contents'];

    expect(callId).toHaveProperty('0.parts.0.functionCall.id', 'call_recompose_0');
    expect(callId).toHaveProperty('1.parts.0.functionResponse.id', 'call_recompose_0');
    expect(JSON.stringify(restored)).not.toContain('cpa_gemini_');
  });

  test('does not restore native provenance after client arguments change', () => {
    const item = { id: 'native-edit', name: 'Edit', args: { replace_all: false } };
    const stable = geminiClaudeToolUseId(item.id, item.name, item.args);
    const restored = replayed(history(stable, 'Edit', { replace_all: true }), [item]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'call_recompose_0');
    expect(restored).not.toHaveProperty('contents.0.parts.0.thoughtSignature', nativeSignature());
    expect(JSON.stringify(restored)).not.toContain('native-edit');
  });
});

test('compacted unknown response names recover their native call and identity', () => {
  const item = { id: 'native-read', name: 'Read', args: { file_path: '/tmp/a' } };
  const stable = geminiClaudeToolUseId(item.id, item.name, item.args);
  const body: JsonObject = {
    model: 'gemini-3.6-flash-high',
    contents: [
      {
        role: 'user',
        parts: [{ functionResponse: { id: stable, name: 'unknown', response: { result: 'ok' } } }],
      },
    ],
  };
  const restored = replayed(body, [item]);

  expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-read');
  expect(restored).toHaveProperty('contents.0.parts.0.functionCall.name', 'Read');
  expect(restored).toHaveProperty('contents.1.parts.0.functionResponse.id', 'native-read');
  expect(restored).toHaveProperty('contents.1.parts.0.functionResponse.name', 'Read');
});

function parallelBody(first: AntigravityReplayItem, second: AntigravityReplayItem): JsonObject {
  return {
    model: 'gemini-3.6-flash-high',
    tools: [tool('Read')],
    contents: [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: geminiClaudeToolUseId(first.id, first.name, first.args),
              name: 'Read',
              args: first.args,
            },
          },
          {
            functionCall: {
              id: geminiClaudeToolUseId(second.id, second.name, second.args),
              name: 'Read',
              args: second.args,
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: geminiClaudeToolUseId(second.id, second.name, second.args),
              name: 'unknown',
              response: {},
            },
          },
          {
            functionResponse: {
              id: geminiClaudeToolUseId(first.id, first.name, first.args),
              name: 'unknown',
              response: {},
            },
          },
        ],
      },
    ],
  };
}

function sentParallelHistory(): unknown {
  const first = { id: 'native-1', name: 'Read', args: { file_path: '/tmp/a' } };
  const second = { id: 'native-2', name: 'Read', args: { file_path: '/tmp/b' } };
  const body = parallelBody(first, second);
  const restored = replayed(body, [first, second]);
  const request = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    restored,
    { accessToken: 'access', projectId: 'project' },
    { requestId: 'request-1', sessionId: 'session-1' },
    1,
  );

  return parsedJson(request.body);
}

test('parallel native provenance restores response identity and order before sending', () => {
  const sent = sentParallelHistory();

  expect(sent).toHaveProperty('request.contents.0.parts.0.functionCall.id', 'native-1');
  expect(sent).toHaveProperty('request.contents.0.parts.1.functionCall.id', 'native-2');
  expect(sent).toHaveProperty('request.contents.1.parts.0.functionResponse.id', 'native-1');
  expect(sent).toHaveProperty('request.contents.1.parts.1.functionResponse.id', 'native-2');
  expect(sent).toHaveProperty('request.contents.1.parts.0.functionResponse.name', 'Read');
});
