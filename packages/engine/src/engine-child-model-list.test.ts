import { describe, expect, test, vi } from 'vitest';

import { attachEngineChild } from './engine-child';
import { aLoopbackHolding, aParent, fetchAnswering, reportsReach } from './engine-child.testkit';

const credential = 'sk-ant-api03-long-secret-7f2c';

const twoModels = JSON.stringify({ data: [{ id: 'gpt-5' }, { id: 'gpt-5-mini' }] });

const credentialedLook = {
  kind: 'list-models',
  id: 'd1',
  origin: 'https://api.openai.com',
  custody: { custody: 'bearer', credential },
};

describe('a model-list directive the parent sends', () => {
  test('the ids the vendor named reach the directive that asked', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, twoModels);

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
    parent.send(credentialedLook);
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      {
        kind: 'model-list',
        answers: 'd1',
        listing: { standing: 'listed', modelIds: ['gpt-5', 'gpt-5-mini'] },
      },
    ]);
    expect(urls).toEqual(['https://api.openai.com/v1/models']);
  });

  test('an open account is read at the address it was handed, with no credential in play', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200, JSON.stringify({ data: [{ id: 'qwen3' }] }));

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
    parent.send({
      kind: 'list-models',
      id: 'd1',
      origin: 'http://127.0.0.1:11434',
      custody: { custody: 'open' },
    });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'model-list', answers: 'd1', listing: { standing: 'listed', modelIds: ['qwen3'] } },
    ]);
    expect(urls).toEqual(['http://127.0.0.1:11434/v1/models']);
  });

  test('a vendor that turned the look away still answers, as unlisted', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchAnswering(401, '{}').fetchLike);
    parent.send(credentialedLook);
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'model-list', answers: 'd1', listing: { standing: 'unlisted' } },
    ]);
  });
});

describe('what a model-list directive leaves behind', () => {
  test('the answer carries no window of the credential it was handed', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchAnswering(200, twoModels).fetchLike);
    parent.send(credentialedLook);
    await reportsReach(parent, 1);

    expect(JSON.stringify(parent.reports)).not.toContain('7f2c');
  });

  test('a look the child cannot read is complained about without spelling the credential', async () => {
    const parent = aParent();
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      attachEngineChild(
        parent.port,
        aLoopbackHolding([]),
        fetchAnswering(200, twoModels).fetchLike,
      );
      parent.send({ ...credentialedLook, origin: '   ' });

      await vi.waitFor(() => {
        expect(complaints).toHaveBeenCalled();
      });

      expect(parent.reports).toEqual([]);
      expect(JSON.stringify(complaints.mock.calls)).not.toContain('7f2c');
    } finally {
      complaints.mockRestore();
    }
  });
});
