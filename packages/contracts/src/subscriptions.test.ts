import { describe, expect, test } from 'vitest';

import {
  subscriptionAccountViewSchema,
  subscriptionProviderIdSchema,
  subscriptionProviders,
  subscriptionStandingSchema,
  subscriptionToolSchema,
} from './subscriptions';

const connectedView = {
  id: 'acc-claude-max',
  provider: 'anthropic',
  label: 'Claude Max',
  signedInAs: 'someone@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

const presentTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'CLAUDE_CONFIG_DIR=/homes/anthropic/pending claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/homes/anthropic/active"',
};

describe('the providers a subscription can name', () => {
  test('exactly the two providers whose own tools sign a person in', () => {
    expect(subscriptionProviderIdSchema.options).toEqual(['anthropic', 'openai', 'antigravity']);
  });

  test('a provider no tool signs in is refused', () => {
    expect(() => subscriptionProviderIdSchema.parse('openrouter')).toThrow();
  });
});

describe('the tool that performs each sign-in', () => {
  test('Anthropic delegates to Claude Code, whose sign-in needs no argument', () => {
    expect(subscriptionProviders.anthropic).toEqual({
      toolBinary: 'claude',
      toolName: 'Claude Code',
      configHomeVariable: 'CLAUDE_CONFIG_DIR',
      signInArguments: [],
    });
  });

  test('OpenAI delegates to Codex, whose sign-in takes its own argument', () => {
    expect(subscriptionProviders.openai).toEqual({
      toolBinary: 'codex',
      toolName: 'Codex',
      configHomeVariable: 'CODEX_HOME',
      signInArguments: ['login'],
    });
  });

  test('every provider the vocabulary names has a tool to delegate to', () => {
    for (const provider of subscriptionProviderIdSchema.options) {
      expect(subscriptionProviders[provider].toolBinary).not.toBe('');
      expect(subscriptionProviders[provider].configHomeVariable).not.toBe('');
    }
  });
});

describe('the standing a row reports', () => {
  test('an account stands connected or lapsed, and never a third thing', () => {
    expect(subscriptionStandingSchema.options).toEqual(['connected', 'lapsed']);
    expect(() => subscriptionStandingSchema.parse('unknown')).toThrow();
  });
});

describe('the view a subscription row renders from', () => {
  test('a full view round-trips', () => {
    expect(subscriptionAccountViewSchema.parse(connectedView)).toEqual(connectedView);
  });

  test('the address and the plan stay absent when the record carries neither', () => {
    const { signedInAs, plan, ...whatTheRecordCarried } = connectedView;

    expect([signedInAs, plan]).toEqual(['someone@example.com', 'Max']);
    expect(subscriptionAccountViewSchema.parse(whatTheRecordCarried)).toEqual(whatTheRecordCarried);
  });

  test('a lapsed account still reports which account it is', () => {
    const lapsed = { ...connectedView, standing: 'lapsed', active: false };

    expect(subscriptionAccountViewSchema.parse(lapsed)).toEqual(lapsed);
  });

  test('a view carries no credential reference and no token material', () => {
    expect(() =>
      subscriptionAccountViewSchema.parse({ ...connectedView, credentialRef: 'cred-7f3a' }),
    ).toThrow();
    expect(() =>
      subscriptionAccountViewSchema.parse({ ...connectedView, accessToken: 'sk-oops' }),
    ).toThrow();
  });

  test('a blank label is refused, because a row with no name names nothing', () => {
    expect(() => subscriptionAccountViewSchema.parse({ ...connectedView, label: '   ' })).toThrow();
  });

  test('a blank address is refused rather than rendering as an empty line', () => {
    expect(() =>
      subscriptionAccountViewSchema.parse({ ...connectedView, signedInAs: '   ' }),
    ).toThrow();
  });

  test('a standing outside the pair is refused', () => {
    expect(() =>
      subscriptionAccountViewSchema.parse({ ...connectedView, standing: 'connecting' }),
    ).toThrow();
  });
});

describe('the tool report the surface reads before offering a sign-in', () => {
  test('a present tool round-trips with its command and its shell setup line', () => {
    expect(subscriptionToolSchema.parse(presentTool)).toEqual(presentTool);
  });

  test('an absent tool still names its command, because the waiting state always shows it', () => {
    const absent = { ...presentTool, present: false };

    expect(subscriptionToolSchema.parse(absent)).toEqual(absent);
  });

  test('a blank sign-in command is refused', () => {
    expect(() => subscriptionToolSchema.parse({ ...presentTool, signInCommand: '   ' })).toThrow();
  });

  test('a tool report carries no secret alongside the command', () => {
    expect(() => subscriptionToolSchema.parse({ ...presentTool, secret: 'sk-oops' })).toThrow();
  });
});
