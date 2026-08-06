import { type EngineGateway, type SpendGrant } from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { hostOver, running, scriptedChild } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

const credential = 'sk-ant-api03-long-secret-7f2c';

const credentialed: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.anthropic.com',
  spend: { custody: 'credentialed', credential },
};

const askFor = (id: string, virtualModel: string): unknown => ({
  kind: 'spend-request',
  id,
  slug: codex.slug,
  virtualModel,
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function servingWith(grantFor: (slug: string, virtualModel: string) => Promise<SpendGrant>) {
  const scripted = scriptedChild(running);
  const { host } = hostOver(scripted, [codex.slug], grantFor);

  await host.start(codex);

  return scripted;
}

describe('the spend lane the child asks the parent over', () => {
  test('a spend request draws back the grant that answers it', async () => {
    const scripted = await servingWith(async () => Promise.resolve(credentialed));

    scripted.send(askFor('s1', 'fast'));

    await vi.waitFor(() => {
      expect(scripted.grants).toStrictEqual([
        { kind: 'spend-grant', answers: 's1', grant: credentialed },
      ]);
    });
  });

  test('a refused grant answers the request rather than leaving the child waiting', async () => {
    const scripted = await servingWith(async () => Promise.resolve({ verdict: 'missing-target' }));

    scripted.send(askFor('s2', 'fast'));

    await vi.waitFor(() => {
      expect(scripted.grants).toStrictEqual([
        { kind: 'spend-grant', answers: 's2', grant: { verdict: 'missing-target' } },
      ]);
    });
  });

  test('a message that is neither a report nor a spend request is written down', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = await servingWith(async () => Promise.resolve(credentialed));

    scripted.send({ kind: 'spend-request', id: 's7' });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('could not read');
    expect(scripted.grants).toStrictEqual([]);
  });
});

describe('a request the parent cannot resolve', () => {
  test('a resolver that fails answers a missing target rather than saying nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const scripted = await servingWith(async () =>
      Promise.reject(new Error('the registry could not be read')),
    );

    scripted.send(askFor('s6', 'fast'));

    await vi.waitFor(() => {
      expect(scripted.grants).toStrictEqual([
        { kind: 'spend-grant', answers: 's6', grant: { verdict: 'missing-target' } },
      ]);
    });
  });

  test('a resolver that fails is written down naming the gateway and the virtual model', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = await servingWith(async () =>
      Promise.reject(new Error('the registry could not be read')),
    );

    scripted.send(askFor('s10', 'thorough'));

    await vi.waitFor(() => {
      expect(scripted.grants).toHaveLength(1);
    });

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('codex');
    expect(spoken).toContain('thorough');
  });
});

describe('which request a grant answers', () => {
  test('the parent resolves the gateway and the virtual model the child named', async () => {
    const scripted = await servingWith(async (slug, virtualModel) =>
      Promise.resolve({
        verdict: 'resolved',
        providerOrigin: `https://${slug}.example/${virtualModel}`,
        spend: { custody: 'open' },
      }),
    );

    scripted.send(askFor('s3', 'thorough'));

    await vi.waitFor(() => {
      expect(scripted.grants).toMatchObject([
        { answers: 's3', grant: { providerOrigin: 'https://codex.example/thorough' } },
      ]);
    });
  });

  test('two requests each draw the grant that answers them', async () => {
    const scripted = await servingWith(async (_slug, virtualModel) =>
      Promise.resolve({
        verdict: 'resolved',
        providerOrigin: `https://${virtualModel}.example`,
        spend: { custody: 'open' },
      }),
    );

    scripted.send(askFor('s4', 'fast'));
    scripted.send(askFor('s5', 'thorough'));

    await vi.waitFor(() => {
      expect(scripted.grants).toMatchObject([
        { answers: 's4', grant: { providerOrigin: 'https://fast.example' } },
        { answers: 's5', grant: { providerOrigin: 'https://thorough.example' } },
      ]);
    });
  });
});

describe('where the credential a grant carries travels', () => {
  test('the credential rides the grant message and no directive the child was given', async () => {
    const scripted = await servingWith(async () => Promise.resolve(credentialed));

    scripted.send(askFor('s8', 'fast'));

    await vi.waitFor(() => {
      expect(JSON.stringify(scripted.grants)).toContain(credential);
    });

    expect(JSON.stringify(scripted.directives)).not.toContain(credential);
  });

  test('a request nobody grants leaves no credential on the lane', async () => {
    const scripted = await servingWith(async () =>
      Promise.resolve({ verdict: 'missing-credential' }),
    );

    scripted.send(askFor('s9', 'fast'));

    await vi.waitFor(() => {
      expect(scripted.grants).toHaveLength(1);
    });

    expect(JSON.stringify(scripted.grants)).not.toContain(credential);
  });
});
