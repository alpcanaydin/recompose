import { expect, test } from 'vitest';

import { sanitizeCodexReasoningBody } from './codex-identities';

test('TestSanitizeOpenAIResponsesReasoningEncryptedContent_StripsOrphanIDsWhenStoreDisabled', () => {
  const body = sanitizeCodexReasoningBody({
    store: false,
    input: [
      { id: 'rs_bad', type: 'reasoning', encrypted_content: 'bad', summary: [] },
      { id: 'rs_orphan', type: 'reasoning', summary: [] },
      { id: 'msg_1', type: 'message', role: 'user', content: 'hi' },
    ],
  });

  expect(body).not.toHaveProperty('input.0.encrypted_content');
  expect(body).not.toHaveProperty('input.0.id');
  expect(body).not.toHaveProperty('input.1.id');
  expect(body).toHaveProperty('input.2.id', 'msg_1');
});

test('TestSanitizeOpenAIResponsesReasoningEncryptedContent_KeepsIDsWhenStoreEnabled', () => {
  const body = sanitizeCodexReasoningBody({
    store: true,
    input: [
      { id: 'rs_bad', type: 'reasoning', encrypted_content: 'bad', summary: [] },
      { id: 'rs_orphan', type: 'reasoning', summary: [] },
    ],
  });

  expect(body).not.toHaveProperty('input.0.encrypted_content');
  expect(body).toHaveProperty('input.0.id', 'rs_bad');
  expect(body).toHaveProperty('input.1.id', 'rs_orphan');
});
