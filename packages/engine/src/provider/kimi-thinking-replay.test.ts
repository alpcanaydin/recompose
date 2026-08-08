import { describe, expect, test } from 'vitest';

import {
  KimiThinkingReplay,
  kimiThinkingReplayModelFamily,
  replayableKimiThinkingContent,
  restoreKimiThinkingContent,
} from './kimi-thinking-replay';

const cached = [
  { type: 'thinking', thinking: 'full reasoning', signature: 'kimi-signature' },
  { type: 'text', text: 'I will inspect the file.' },
  { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
];

const compacted = {
  messages: [
    { role: 'user', content: 'inspect' },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will inspect the file.' },
        { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
      ],
    },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] },
  ],
};

describe('kimiThinkingReplayModelFamily', () => {
  test.each([
    ['k3', 'k3'],
    ['kimi-k3', 'k3'],
    ['k3-256k', 'k3'],
    ['kimi-k3-256k(high)', 'k3'],
    ['kimi-k2.7-code', 'k2.7-code'],
    ['kimi-k2.7-code-highspeed', 'k2.7-code-highspeed'],
  ])('maps %s to %s', (model, family) => {
    expect(kimiThinkingReplayModelFamily(model)).toBe(family);
  });
});

describe('restoreKimiThinkingContent', () => {
  test('restores the complete cached assistant content', () => {
    const restored = restoreKimiThinkingContent(compacted, cached);

    expect(restored.applied).toBe(true);
    expect(restored.body).toHaveProperty('messages.1.content', cached);
  });

  test('does not replace assistant content that already carries thinking', () => {
    const body = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'current', signature: 'current-signature' },
            { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { path: 'README.md' } },
          ],
        },
      ],
    };
    const restored = restoreKimiThinkingContent(body, cached);

    expect(restored).toEqual({ body, applied: false });
  });
});

describe('KimiThinkingReplay', () => {
  test('shares replay across K3 variants only', () => {
    const replay = new KimiThinkingReplay();

    expect(replay.commit('k3', 'execution:family-switch', cached)).toBe(true);
    expect(replay.inject('kimi-k3-256k', 'execution:family-switch', compacted).applied).toBe(true);
    expect(
      replay.inject('kimi-k2.7-code-highspeed', 'execution:family-switch', compacted).applied,
    ).toBe(false);
  });

  test('isolates Claude root and subagent scopes', () => {
    const replay = new KimiThinkingReplay();
    const root = 'claude:session-1:agent:main';
    const subagent = 'claude:session-1:agent:subagent-1';

    replay.commit('kimi-k3', root, cached);

    expect(replay.inject('kimi-k3-256k', root, compacted).applied).toBe(true);
    expect(replay.inject('kimi-k3-256k', subagent, compacted).applied).toBe(false);
  });

  test('refuses a commit without a scope or without replayable content', () => {
    const replay = new KimiThinkingReplay();

    expect(replay.commit('k3', '   ', cached)).toBe(false);
    expect(replay.commit('k3', 'scope', 'not a list')).toBe(false);
    expect(replay.commit('k3', 'scope', [{ type: 'text', text: 'plain' }])).toBe(false);
  });

  test('replaces an entry only while the snapshot still describes it', () => {
    const replay = new KimiThinkingReplay();
    const snapshot = replay.snapshot('k3', 'scope');

    expect(replay.replaceIfUnchanged('k3', 'scope', snapshot, 'not a list')).toBe(false);
    expect(replay.replaceIfUnchanged('k3', 'scope', snapshot, [{ type: 'text', text: 'x' }])).toBe(
      false,
    );
    expect(replay.replaceIfUnchanged('k3', 'scope', snapshot, cached)).toBe(true);
    expect(replay.inject('k3', 'scope', compacted).applied).toBe(true);
    expect(replay.replaceIfUnchanged('k3', 'scope', snapshot, cached)).toBe(false);
  });
});

describe('replayableKimiThinkingContent', () => {
  test('content that is not a list of parts cannot be replayed', () => {
    expect(replayableKimiThinkingContent('reasoning text')).toBe(false);
    expect(replayableKimiThinkingContent([{ type: 'thinking' }, 'raw part'])).toBe(false);
  });

  test('signed thinking without a named tool call cannot be replayed', () => {
    expect(replayableKimiThinkingContent([{ type: 'thinking', signature: '   ' }])).toBe(false);
    expect(
      replayableKimiThinkingContent([
        { type: 'thinking', signature: 'sig' },
        { type: 'tool_use', id: '   ' },
      ]),
    ).toBe(false);
  });
});

describe('restore refusals', () => {
  test('a body without a message list is left as it stands', () => {
    expect(restoreKimiThinkingContent({ messages: 'none' }, cached).applied).toBe(false);
    expect(restoreKimiThinkingContent({ messages: [] }, 'not a list').applied).toBe(false);
  });

  test('cached content without a tool call cannot be restored', () => {
    const thinkingOnly = [
      { type: 'thinking', thinking: 'full reasoning', signature: 'kimi-signature' },
      { type: 'text', text: 'I will inspect the file.' },
    ];

    expect(restoreKimiThinkingContent(compacted, thinkingOnly).applied).toBe(false);
  });

  test('turns that are not assistant block content are passed over', () => {
    const body = {
      messages: [
        'raw turn',
        { role: 'user', content: 'inspect' },
        { role: 'assistant', content: 'plain answer' },
      ],
    };

    expect(restoreKimiThinkingContent(body, cached).applied).toBe(false);
  });
});
