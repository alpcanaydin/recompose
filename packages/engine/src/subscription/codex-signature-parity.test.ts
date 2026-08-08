import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { codexProviderRequest } from './codex-request';

const validSignature =
  'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function bodyOf(input: JsonObject[], compact = false): JsonObject {
  const request = codexProviderRequest(
    'https://chatgpt.com/backend-api/codex',
    { model: 'gpt-5.4', input },
    { accessToken: 'codex-access' },
    'session-1',
    false,
    'cache-1',
    compact,
  );
  const value: unknown = JSON.parse(request.body);

  return isJsonObject(value) ? value : {};
}

function signatureInput(): JsonObject[] {
  return [
    { id: 'rs_bad', type: 'reasoning', encrypted_content: 'gAAAAABinvalid', summary: [] },
    { id: 'rs_non_string', type: 'reasoning', encrypted_content: 123, summary: [] },
    { id: 'rs_good', type: 'reasoning', encrypted_content: validSignature, summary: [] },
    { role: 'user', content: 'hello', encrypted_content: 'leave-message-alone' },
  ];
}

function expectSanitized(body: JsonObject): void {
  expect(body).not.toHaveProperty('input.0.encrypted_content');
  expect(body).not.toHaveProperty('input.0.id');
  expect(body).not.toHaveProperty('input.1.encrypted_content');
  expect(body).not.toHaveProperty('input.1.id');
  expect(body).toHaveProperty('input.2.encrypted_content', validSignature);
  expect(body).toHaveProperty('input.3.encrypted_content', 'leave-message-alone');
}

describe('Codex encrypted reasoning request parity', () => {
  test('TestCodexExecutorDropsInvalidReasoningEncryptedContentFromFinalRequest', () => {
    expectSanitized(bodyOf(signatureInput()));
  });

  test('TestCodexExecutorExecuteStreamDropsInvalidReasoningEncryptedContentFromFinalRequest', () => {
    expectSanitized(bodyOf(signatureInput()));
  });

  test('TestCodexExecutorCompactDropsInvalidReasoningEncryptedContentFromFinalRequest', () => {
    expectSanitized(bodyOf(signatureInput(), true));
  });
});
