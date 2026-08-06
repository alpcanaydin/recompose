import { engineSpendRequestSchema } from '@recompose/contracts';
import { describe, expect, test, vi } from 'vitest';

import { attachEngineChild } from './engine-child';
import { aLoopbackHolding, aParent, reportsReach } from './engine-child.testkit';
import {
  aGatewayHolding,
  aGrantAnswering,
  aLoopbackCapturing,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
  openedApp,
} from './gateway-app.testkit';

const fast = aVirtualModel();
const smart = aVirtualModel({
  id: 'smart',
  displayName: 'Smart',
  target: { standing: 'bound', providerModel: 'gpt-5' },
});

function chatBody(model: string): string {
  return JSON.stringify({ model, messages: [{ role: 'user', content: 'hello' }] });
}

function aServingChild(...models: readonly (typeof fast)[]) {
  const parent = aParent();
  const capturing = aLoopbackCapturing();
  const { sent, fetchLike } = fetchAnsweringWith(() => Response.json({ choices: [] }));

  attachEngineChild(parent.port, capturing.openListeners, fetchLike);
  parent.send({ kind: 'start', id: 'd1', gateway: aGatewayHolding(...models) });

  return { parent, capturing, sent };
}

async function askUnder(child: ReturnType<typeof aServingChild>, model: string) {
  return openedApp(child.capturing).request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: chatBody(model),
  });
}

describe('a request arriving under a defined name', () => {
  test('asks the parent for a spend grant naming the gateway and the model', async () => {
    const child = aServingChild(fast);

    await reportsReach(child.parent, 1);

    const answering = askUnder(child, 'fast');

    await reportsReach(child.parent, 2);

    const ask = engineSpendRequestSchema.parse(child.parent.reports[1]);

    expect(ask).toMatchObject({ kind: 'spend-request', slug: 'codex', virtualModel: 'fast' });

    child.parent.send(aGrantAnswering(ask.id, 'http://127.0.0.1:4242'));

    const answer = await answering;

    expect(child.sent.at(0)?.url).toBe('http://127.0.0.1:4242/v1/chat/completions');
    expect(answer.status).toBe(200);
  });

  test('a refused grant answers the caller through the same lane', async () => {
    const child = aServingChild(fast);

    await reportsReach(child.parent, 1);

    const answering = askUnder(child, 'fast');

    await reportsReach(child.parent, 2);

    const ask = engineSpendRequestSchema.parse(child.parent.reports[1]);

    child.parent.send({
      kind: 'spend-grant',
      answers: ask.id,
      grant: { verdict: 'missing-credential' },
    });

    expect((await answering).status).toBe(502);
    expect(child.sent).toEqual([]);
  });
});

describe('two grants in flight at once', () => {
  test('each answer reaches the request that asked, whichever lands first', async () => {
    const child = aServingChild(fast, smart);

    await reportsReach(child.parent, 1);

    const underFast = askUnder(child, 'fast');
    const underSmart = askUnder(child, 'smart');

    await reportsReach(child.parent, 3);

    const asks = [child.parent.reports[1], child.parent.reports[2]].map((report) =>
      engineSpendRequestSchema.parse(report),
    );
    const askFor = (virtualModel: string): string => {
      const ask = asks.find((candidate) => candidate.virtualModel === virtualModel);

      if (ask === undefined) {
        throw new Error(`no spend request asked for ${virtualModel}`);
      }

      return ask.id;
    };

    child.parent.send(aGrantAnswering(askFor('smart'), 'http://127.0.0.1:4243'));
    child.parent.send(aGrantAnswering(askFor('fast'), 'http://127.0.0.1:4242'));
    await Promise.all([underFast, underSmart]);

    const forwarded = child.sent.map((request, at) => ({
      url: request.url,
      model: bodySentIn(child.sent, at)['model'],
    }));

    expect(forwarded).toContainEqual({
      url: 'http://127.0.0.1:4242/v1/chat/completions',
      model: 'gpt-5-mini',
    });
    expect(forwarded).toContainEqual({
      url: 'http://127.0.0.1:4243/v1/chat/completions',
      model: 'gpt-5',
    });
  });
});

describe('a grant answering an open request', () => {
  test('settles it quietly, drawing no complaint at all', async () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const child = aServingChild(fast);

      await reportsReach(child.parent, 1);

      const answering = askUnder(child, 'fast');

      await reportsReach(child.parent, 2);

      const ask = engineSpendRequestSchema.parse(child.parent.reports[1]);

      child.parent.send(aGrantAnswering(ask.id, 'http://127.0.0.1:4242'));
      await answering;

      expect(complaints).not.toHaveBeenCalled();
    } finally {
      complaints.mockRestore();
    }
  });
});

describe('a spend grant no request awaits', () => {
  test('draws its own complaint, never the unreadable-directive one', () => {
    const parent = aParent();
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]));
      parent.send({ kind: 'spend-grant', answers: 'nobody', grant: { verdict: 'missing-target' } });

      expect(complaints).toHaveBeenCalledWith(expect.stringContaining('no open request'));
      expect(complaints).not.toHaveBeenCalledWith(
        expect.stringContaining('could not read'),
        expect.anything(),
      );
    } finally {
      complaints.mockRestore();
    }
  });
});
