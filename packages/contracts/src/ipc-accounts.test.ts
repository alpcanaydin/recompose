import { describe, expect, test } from 'vitest';

import { ipcChannels, ipcErrorSchema } from './ipc';

const connect = ipcChannels['accounts:connect'].request;

const offered = { provider: 'anthropic', kind: 'api-key', label: 'Work', secret: 'sk-abc' };

describe('accounts:connect channel', () => {
  test('request requires a non-blank secret and rejects extras', () => {
    expect(() => connect.parse(offered)).not.toThrow();
    expect(() => connect.parse({ ...offered, secret: '   ' })).toThrow();
    expect(() => connect.parse({ ...offered, credentialRef: 'sneak' })).toThrow();
  });

  test('no secret can be offered for a subscription, because none exists to offer', () => {
    const offer = { provider: 'anthropic', label: 'Claude Max', secret: 'sk-abc' };

    expect(connect.safeParse({ ...offer, kind: 'subscription' }).success).toBe(false);
    expect(connect.safeParse({ ...offer, kind: 'local' }).success).toBe(false);
    expect(connect.safeParse({ ...offer, kind: 'aggregator' }).success).toBe(true);
  });

  test('a label of nothing but whitespace names no account, so it is refused', () => {
    expect(() => connect.parse({ ...offered, label: ' ' })).toThrow();
  });

  test('a label with surrounding whitespace parses to its trim, so one name has one spelling', () => {
    expect(connect.parse({ ...offered, label: ' build ' })).toMatchObject({ label: 'build' });
  });
});

describe('the key the connect channel carries', () => {
  test('a key pasted with a trailing newline reaches the vault as its trim', () => {
    expect(connect.parse({ ...offered, secret: '  sk-ant-api03-9f2c\n' })).toEqual({
      ...offered,
      secret: 'sk-ant-api03-9f2c',
    });
  });

  test('a key holding an interior control character is refused for what it holds', () => {
    expect(() =>
      connect.parse({ ...offered, secret: `sk-ant${String.fromCodePoint(0)}9f2c` }),
    ).toThrow(/holds a control character/);
  });
});

describe('what the connect channel answers', () => {
  test('responses cannot smuggle the secret back', () => {
    const registry = {
      schemaVersion: 3,
      accounts: [
        {
          id: 'a1',
          provider: 'anthropic',
          kind: 'api-key',
          label: 'Work',
          credentialRef: 'c1',
          keyTail: '9f2c',
        },
      ],
    };
    const smuggled = {
      schemaVersion: 3,
      accounts: [{ ...registry.accounts[0], secret: 'sk-abc' }],
    };

    expect(() =>
      ipcChannels['accounts:connect'].response.parse({ ok: true, value: registry }),
    ).not.toThrow();
    expect(() =>
      ipcChannels['accounts:connect'].response.parse({ ok: true, value: smuggled }),
    ).toThrow();
  });
});

describe('accounts:check-key channel', () => {
  test('a check names one stored row, and carries neither a provider nor a key', () => {
    const check = ipcChannels['accounts:check-key'].request;

    expect(check.safeParse({ id: 'acc-work-key' }).success).toBe(true);
    expect(check.safeParse({ id: '   ' }).success).toBe(false);
    expect(check.safeParse({ provider: 'anthropic' }).success).toBe(false);
    expect(check.safeParse({ id: 'acc-work-key', secret: 'sk-abc' }).success).toBe(false);
  });

  test('a check answers one of the three verdicts and the status behind it', () => {
    const answered = { ok: true, value: { verdict: 'not-accepted', status: 401 } };

    expect(ipcChannels['accounts:check-key'].response.parse(answered)).toEqual(answered);
  });

  test('a check that never reached the vendor answers a verdict alone', () => {
    const unreached = { ok: true, value: { verdict: 'could-not-check' } };

    expect(ipcChannels['accounts:check-key'].response.parse(unreached)).toEqual(unreached);
  });

  test('no vendor sentence and no key can ride the answer to the screen', () => {
    for (const smuggled of [{ body: 'invalid x-api-key' }, { key: 'sk-ant-api03-9f2c' }]) {
      expect(() =>
        ipcChannels['accounts:check-key'].response.parse({
          ok: true,
          value: { verdict: 'authenticates', ...smuggled },
        }),
      ).toThrow();
    }
  });

  test('a rejected key is a verdict rather than a refusal, so no new error code lands', () => {
    expect(ipcErrorSchema.shape.code.options).not.toContain('key-rejected');
  });
});
