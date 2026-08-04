import type { MockInstance } from 'vitest';

import { describe, expect, test, vi } from 'vitest';

import { attachEngineChild } from './engine-child';
import { aLoopbackHolding, aParent, fetchAnswering, reportsReach } from './engine-child.testkit';

function spokenBy(complaints: MockInstance<typeof console.error>): string {
  return complaints.mock.calls.flat().map(String).join(' ');
}

describe('the origin a probe reaches', () => {
  test('each vendor is probed at its own first-party host by default, with nothing to complain about', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
      parent.send({
        kind: 'probe',
        id: 'd2',
        provider: 'openai',
        key: 'sk-proj-fake-openai-paste',
      });
      await reportsReach(parent, 2);

      expect(urls).toEqual([
        'https://api.anthropic.com/v1/models',
        'https://api.openai.com/v1/models',
      ]);
      expect(complaints).not.toHaveBeenCalled();
    } finally {
      complaints.mockRestore();
    }
  });

  test('the environment substitutes the probe origin for every vendor', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);

    vi.stubEnv('RECOMPOSE_PROBE_ORIGIN', 'http://127.0.0.1:8642');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
      parent.send({
        kind: 'probe',
        id: 'd2',
        provider: 'openai',
        key: 'sk-proj-fake-openai-paste',
      });
      await reportsReach(parent, 2);

      expect(urls).toEqual(['http://127.0.0.1:8642/v1/models', 'http://127.0.0.1:8642/v1/models']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('the origin a runtime probe reaches', () => {
  test('the address the directive carried stands by default, with nothing to complain about', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe-runtime', id: 'd1', address: 'http://127.0.0.1:11434' });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['http://127.0.0.1:11434/api/version']);
      expect(complaints).not.toHaveBeenCalled();
    } finally {
      complaints.mockRestore();
    }
  });

  test('the environment substitutes the runtime origin for the address the directive carried', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');

    vi.stubEnv('RECOMPOSE_RUNTIME_ORIGIN', 'http://127.0.0.1:8711');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe-runtime', id: 'd1', address: 'http://127.0.0.1:11434' });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['http://127.0.0.1:8711/api/version']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('the runtime override the child refuses to hear', () => {
  test('an override that leaves the loopback stays unheard, so the look stays on the machine', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.stubEnv('RECOMPOSE_RUNTIME_ORIGIN', 'https://collector.example');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe-runtime', id: 'd1', address: 'http://127.0.0.1:11434' });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['http://127.0.0.1:11434/api/version']);

      const spoken = spokenBy(complaints);

      expect(spoken).toContain('RECOMPOSE_RUNTIME_ORIGIN');
      expect(spoken).toContain('loopback');
      expect(spoken).not.toContain('collector.example');
    } finally {
      vi.unstubAllEnvs();
      complaints.mockRestore();
    }
  });

  test('an override that does not parse as a URL stays unheard the same way', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.stubEnv('RECOMPOSE_RUNTIME_ORIGIN', 'not a url');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe-runtime', id: 'd1', address: 'http://127.0.0.1:11434' });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['http://127.0.0.1:11434/api/version']);

      const spoken = spokenBy(complaints);

      expect(spoken).toContain('RECOMPOSE_RUNTIME_ORIGIN');
      expect(spoken).toContain('loopback');
      expect(spoken).not.toContain('not a url');
    } finally {
      vi.unstubAllEnvs();
      complaints.mockRestore();
    }
  });
});

describe('the names a loopback override may go by', () => {
  test.each(['http://localhost:8642', 'http://[::1]:8642'])('%s is heard', async (origin) => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);

    vi.stubEnv('RECOMPOSE_PROBE_ORIGIN', origin);

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
      await reportsReach(parent, 1);

      expect(urls).toEqual([`${origin}/v1/models`]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('the override the child refuses to hear', () => {
  test('an override that leaves the loopback stays unheard, so a key never follows it', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.stubEnv('RECOMPOSE_PROBE_ORIGIN', 'https://collector.example');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['https://api.anthropic.com/v1/models']);

      const spoken = spokenBy(complaints);

      expect(spoken).toContain('RECOMPOSE_PROBE_ORIGIN');
      expect(spoken).toContain('loopback');
      expect(spoken).not.toContain('collector.example');
    } finally {
      vi.unstubAllEnvs();
      complaints.mockRestore();
    }
  });

  test('an override that does not parse as a URL stays unheard the same way', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.stubEnv('RECOMPOSE_PROBE_ORIGIN', 'not a url');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({
        kind: 'probe',
        id: 'd1',
        provider: 'openai',
        key: 'sk-proj-fake-openai-paste',
      });
      await reportsReach(parent, 1);

      expect(urls).toEqual(['https://api.openai.com/v1/models']);

      const spoken = spokenBy(complaints);

      expect(spoken).toContain('RECOMPOSE_PROBE_ORIGIN');
      expect(spoken).toContain('loopback');
      expect(spoken).not.toContain('not a url');
    } finally {
      vi.unstubAllEnvs();
      complaints.mockRestore();
    }
  });
});
