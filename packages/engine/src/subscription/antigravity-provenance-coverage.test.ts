import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { geminiClaudeToolUseId } from '../dialect/gemini-tool-provenance';
import { restoreAntigravityToolProvenance } from './antigravity-provenance';

const READ_ITEM = { id: 'native-read', name: 'Read', args: { file_path: '/tmp/a' } };

function callPart(id: string, name: string, args?: JsonObject): JsonObject {
  return { functionCall: { id, name, ...(args === undefined ? {} : { args }) } };
}

function stableIdFor(item: { id: string; name: string; args: JsonObject }): string {
  return geminiClaudeToolUseId(item.id, item.name, item.args);
}

function ragbagTools(): unknown[] {
  return [
    'not-a-tool',
    { name: 'declares-nothing' },
    { functionDeclarations: 'not-an-array' },
    {
      functionDeclarations: [
        'not-a-declaration',
        { name: 'Read' },
        { name: 'Grep', parameters: { type: 'object' } },
        { name: '', parameters: { type: 'object', properties: { flag: { default: true } } } },
        { name: 'Glob', parameters: { type: 'object', properties: { pattern: 'not-an-object' } } },
      ],
    },
  ];
}

describe('restoring native tool identity from a replayed Antigravity turn', () => {
  test('tool declarations of every malformed shape still leave the call restorable', () => {
    const body: JsonObject = {
      tools: ragbagTools(),
      contents: [
        { role: 'model', parts: [callPart(stableIdFor(READ_ITEM), 'Read', READ_ITEM.args)] },
      ],
    };

    const restored = restoreAntigravityToolProvenance(body, [READ_ITEM]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-read');
  });

  test('a call carrying no arguments matches a replayed item that carried none', () => {
    const item = { id: 'native-ls', name: 'LS', args: {} };
    const body: JsonObject = {
      contents: [{ role: 'model', parts: [callPart(stableIdFor(item), 'LS')] }],
    };

    const restored = restoreAntigravityToolProvenance(body, [item]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-ls');
    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.args', {});
  });

  test('malformed conversation entries are passed over while the real call is restored', () => {
    const body: JsonObject = {
      contents: [
        'not-a-content',
        { role: 'model' },
        {
          role: 'model',
          parts: ['not-a-part', callPart(stableIdFor(READ_ITEM), 'Read', READ_ITEM.args)],
        },
      ],
    };

    const restored = restoreAntigravityToolProvenance(body, [READ_ITEM]);

    expect(restored).toHaveProperty('contents.2.parts.1.functionCall.id', 'native-read');
    expect(restored).toHaveProperty('contents.0', 'not-a-content');
  });
});

describe('restoring a turn the replay only partly recognizes', () => {
  test('a call the replay cannot account for keeps the identifier the client sent', () => {
    const item = { id: 'native-edit', name: 'Edit', args: { file_path: '/tmp/a' } };
    const body: JsonObject = {
      contents: [
        {
          role: 'model',
          parts: [
            callPart('Edit-client-1', 'Edit', { file_path: '/tmp/a' }),
            callPart('plain-id', 'Grep', { pattern: 'needle' }),
          ],
        },
      ],
    };

    const restored = restoreAntigravityToolProvenance(body, [item]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-edit');
    expect(restored).toHaveProperty('contents.0.parts.1.functionCall.id', 'plain-id');
  });

  test('an anonymous replayed item lends no identity to an unrecognized response', () => {
    const anonymous = { id: '', name: 'Read', args: {} };
    const body: JsonObject = {
      contents: [
        { role: 'model', parts: [callPart(stableIdFor(READ_ITEM), 'Read', READ_ITEM.args)] },
        {
          role: 'user',
          parts: [{ functionResponse: { id: 'never-seen', name: 'Read', response: {} } }],
        },
      ],
    };

    const restored = restoreAntigravityToolProvenance(body, [anonymous, READ_ITEM]);

    expect(restored).toHaveProperty('contents.0.parts.0.functionCall.id', 'native-read');
    expect(restored).toHaveProperty('contents.1.parts.0.functionResponse.id', 'never-seen');
  });
});
