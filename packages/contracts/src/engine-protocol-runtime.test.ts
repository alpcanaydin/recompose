import { describe, expect, test } from 'vitest';

import { engineDirectiveSchema, engineReportSchema } from './engine-protocol';

const gateway = { slug: 'personal', displayName: 'Personal', port: 8397 };

describe('the probe directive that asks whether a runtime answers', () => {
  const probeRuntime = { kind: 'probe-runtime', id: 'd2', address: 'http://127.0.0.1:11434' };

  test('a runtime probe carries the loopback address it will look at', () => {
    expect(engineDirectiveSchema.parse(probeRuntime)).toEqual(probeRuntime);
  });

  test('a runtime probe aimed off this machine is refused at the parse', () => {
    for (const address of [
      'http://localhost:11434',
      'http://example.com:11434',
      'http://169.254.169.254',
    ]) {
      expect(() => engineDirectiveSchema.parse({ ...probeRuntime, address })).toThrow();
    }
  });

  test('a runtime probe carries no key, because a loopback look spends nothing', () => {
    expect(() =>
      engineDirectiveSchema.parse({ ...probeRuntime, key: 'sk-ant-api03-9f2c' }),
    ).toThrow();
  });

  test('a runtime probe names no vendor, because the address is the whole of the aim', () => {
    expect(() => engineDirectiveSchema.parse({ ...probeRuntime, provider: 'ollama' })).toThrow();
  });

  test('a runtime probe carries no gateway, because it serves no traffic', () => {
    expect(() => engineDirectiveSchema.parse({ ...probeRuntime, gateway })).toThrow();
  });

  test('a runtime probe answering nobody is refused, because its reading would reach no one', () => {
    const { id, ...withoutTheIdentifier } = probeRuntime;

    expect(id).toBe('d2');
    expect(() => engineDirectiveSchema.parse(withoutTheIdentifier)).toThrow();
  });
});

describe('the reading a runtime look sends home', () => {
  const answered = {
    kind: 'runtime-check',
    answers: 'd2',
    reachability: { verdict: 'answers', version: '0.5.1' },
  };

  test('a look that found the runtime carries the version it reported', () => {
    expect(engineReportSchema.parse(answered)).toEqual(answered);
  });

  test('a look that found a stranger carries the status it answered with', () => {
    const stranger = {
      kind: 'runtime-check',
      answers: 'd2',
      reachability: { verdict: 'unrecognized', status: 404 },
    };

    expect(engineReportSchema.parse(stranger)).toEqual(stranger);
  });

  test('a look that found silence carries the verdict alone', () => {
    const silence = {
      kind: 'runtime-check',
      answers: 'd2',
      reachability: { verdict: 'unreachable' },
    };

    expect(engineReportSchema.parse(silence)).toEqual(silence);
  });

  test('a runtime reading naming a gateway is refused, because a look belongs to none', () => {
    expect(() => engineReportSchema.parse({ ...answered, slug: 'personal' })).toThrow();
  });

  test('a runtime reading answering no directive is refused', () => {
    const { answers, ...withoutTheDirective } = answered;

    expect(answers).toBe('d2');
    expect(() => engineReportSchema.parse(withoutTheDirective)).toThrow();
  });

  test('a runtime reading cannot borrow the words a key check answers with', () => {
    for (const verdict of ['authenticates', 'not-accepted', 'could-not-check']) {
      expect(() => engineReportSchema.parse({ ...answered, reachability: { verdict } })).toThrow();
    }
  });

  test('a runtime reading carries neither the address it looked at nor the body it read', () => {
    for (const smuggled of [
      { address: 'http://127.0.0.1:11434' },
      { body: '{"version":"0.5.1"}' },
      { verdict: 'answers' },
    ]) {
      expect(() => engineReportSchema.parse({ ...answered, ...smuggled })).toThrow();
    }
  });
});
