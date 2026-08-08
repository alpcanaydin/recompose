import { describe, expect, test } from 'vitest';

import { claudeBillingFingerprint, signedClaudeBody } from './claude-cch';

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

const breakpoint = { type: 'ephemeral' };

const budgetBody = {
  model: 'model-a',
  system: [
    {
      type: 'text',
      text: 'x-anthropic-billing-header: cc_version=2.1.220.abc; cc_entrypoint=cli; cch=00000;',
    },
    { type: 'text', text: 'sys-a', cache_control: breakpoint },
    { type: 'text', text: 'sys-b', cache_control: breakpoint },
  ],
  tools: [
    { name: 'tool-a', cache_control: breakpoint },
    { name: 'tool-b', cache_control: breakpoint },
  ],
  messages: [
    'stray-message',
    { role: 'user', content: 'plain-text-turn' },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'msg-a', cache_control: breakpoint },
        { type: 'text', text: 'msg-b', cache_control: breakpoint },
      ],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cchOf(body: Record<string, unknown>): string {
  const match = / cch=([a-f\d]{5});/u.exec(signedClaudeBody(body));

  return match?.[1] ?? '';
}

function signedSystem(body: Record<string, unknown>): unknown[] {
  const parsed: unknown = JSON.parse(signedClaudeBody(body));
  const system = isRecord(parsed) ? parsed['system'] : undefined;

  return Array.isArray(system) ? system : [];
}

function blockLabel(block: Record<string, unknown>): string {
  return String(block['name'] ?? block['text']);
}

function labelsKeepingBreakpoint(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((block) =>
        isRecord(block) && block['cache_control'] !== undefined ? [blockLabel(block)] : [],
      )
    : [];
}

function survivingBreakpoints(body: Record<string, unknown>): string[] {
  const parsed: unknown = JSON.parse(signedClaudeBody(body));
  const owner = isRecord(parsed) ? parsed : {};
  const messages = Array.isArray(owner['messages']) ? owner['messages'] : [];

  return [
    ...labelsKeepingBreakpoint(owner['tools']),
    ...labelsKeepingBreakpoint(owner['system']),
    ...messages.flatMap((message: unknown) =>
      isRecord(message) ? labelsKeepingBreakpoint(message['content']) : [],
    ),
  ];
}

const CLAUDE_CODE_IDENTITY_FOR_TEST = "You are Claude Code, Anthropic's official CLI for Claude.";

const BILLING_WITHOUT_CCH =
  'x-anthropic-billing-header: cc_version=2.1.220.abc; cc_entrypoint=cli;';

const BILLING_WITHOUT_ENTRYPOINT = 'x-anthropic-billing-header: cc_version=2.1.220.abc;';

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

describe('the billing fingerprint reads the last user turn', () => {
  test('a body carrying no messages fingerprints as an empty turn', () => {
    expect(claudeBillingFingerprint({})).toBe(claudeBillingFingerprint({ messages: [] }));
  });

  test('assistant turns and non-object entries leave no trace', () => {
    const ignored = {
      messages: ['stray', { role: 'assistant', content: 'a long assistant answer here' }],
    };

    expect(claudeBillingFingerprint(ignored)).toBe(claudeBillingFingerprint({ messages: [] }));
  });

  test('content that is neither string nor array reads as an empty turn', () => {
    const numeric = { messages: [{ role: 'user', content: 42 }] };

    expect(claudeBillingFingerprint(numeric)).toBe(claudeBillingFingerprint({ messages: [] }));
  });

  test('a content array without a text part reads as an empty turn', () => {
    const imageOnly = {
      messages: [
        {
          role: 'user',
          content: ['bare', { type: 'image', source: 'omitted' }, { type: 'text', text: 42 }],
        },
      ],
    };

    expect(claudeBillingFingerprint(imageOnly)).toBe(claudeBillingFingerprint({ messages: [] }));
  });

  test('the latest user turn wins over an earlier one', () => {
    const late = 'zzzzzzzzzzzzzzzzzzzzzzzzzz';
    const both = {
      messages: [
        { role: 'user', content: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { role: 'user', content: late },
      ],
    };

    expect(claudeBillingFingerprint(both)).toBe(
      claudeBillingFingerprint({ messages: [{ role: 'user', content: late }] }),
    );
  });

  test('a turn longer than the sampled offsets fingerprints apart from a short one', () => {
    const long = { messages: [{ role: 'user', content: 'abcdefghijklmnopqrstuvwxyz' }] };

    expect(claudeBillingFingerprint(long)).not.toBe(claudeBillingFingerprint({ messages: [] }));
  });
});

describe('the Claude Code system prefix', () => {
  test('a body without a system gains the billing block and the identity alone', () => {
    const system = signedSystem({ messages: [{ role: 'user', content: 'hello' }] });

    expect(system).toHaveLength(2);
    expect(JSON.stringify(system.at(1))).toContain(CLAUDE_CODE_IDENTITY_FOR_TEST);
  });

  test('a leading block that is not an object keeps its place behind the billing block', () => {
    const system = signedSystem({ system: ['plain-instruction'] });

    expect(system).toHaveLength(3);
    expect(system.at(2)).toBe('plain-instruction');
  });

  test('a leading block without text is treated as caller content', () => {
    const system = signedSystem({ system: [{ type: 'image' }] });

    expect(system).toHaveLength(3);
    expect(system.at(2)).toStrictEqual({ type: 'image' });
  });

  test('a leading block whose text is not the billing header is treated as caller content', () => {
    const system = signedSystem({ system: [{ type: 'text', text: 'caller rules' }] });

    expect(system).toHaveLength(3);
    expect(system.at(2)).toStrictEqual({ type: 'text', text: 'caller rules' });
  });
});

describe('an existing billing header is signed in place', () => {
  test('a header missing the cch slot gains one after the entrypoint', () => {
    const system = signedSystem({ system: [{ type: 'text', text: BILLING_WITHOUT_CCH }] });

    expect(system).toHaveLength(1);
    expect(JSON.stringify(system.at(0))).toMatch(/cc_entrypoint=cli; cch=[a-f\d]{5};/u);
  });

  test('a header without an entrypoint is left unsigned', () => {
    const system = signedSystem({ system: [{ type: 'text', text: BILLING_WITHOUT_ENTRYPOINT }] });

    expect(system).toStrictEqual([{ type: 'text', text: BILLING_WITHOUT_ENTRYPOINT }]);
  });
});

describe('the four cache breakpoint budget', () => {
  test('the oldest system and tool breakpoints yield so four survive', () => {
    expect(survivingBreakpoints(budgetBody)).toStrictEqual(['tool-b', 'sys-b', 'msg-a', 'msg-b']);
  });

  test('a body without tools that is already inside the budget keeps every breakpoint', () => {
    const { tools: _tools, ...spare } = budgetBody;

    expect(survivingBreakpoints(spare)).toStrictEqual(['sys-a', 'sys-b', 'msg-a', 'msg-b']);
  });
});

describe('CCH normalization ignores volatile fields', () => {
  test('fallback fields never move the signature', () => {
    expect(cchOf({ ...base, fallbacks: ['model-z'], fallback_credit_token: 'token-z' })).toBe(
      cchOf(base),
    );
  });

  test('an omitted field nested inside an array never moves the signature', () => {
    const one = { ...base, plan: [{ max_tokens: 1, step: 'a' }] };
    const two = { ...base, plan: [{ max_tokens: 999, step: 'a' }] };

    expect(cchOf(one)).toBe(cchOf(two));
  });

  test('a non-string model still moves the signature', () => {
    expect(cchOf({ ...base, model: 1 })).not.toBe(cchOf({ ...base, model: 2 }));
  });

  test('a null field is carried through normalization', () => {
    expect(cchOf({ ...base, note: null })).not.toBe(cchOf(base));
  });
});
