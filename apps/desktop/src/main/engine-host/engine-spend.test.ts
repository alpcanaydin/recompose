import type { EngineSpendGrant, EngineSpendRequest, SpendGrant } from '@recompose/contracts';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { answerSpendRequest } from './engine-spend';

const credential = 'sk-ant-api03-long-secret-7f2c';

const asked: EngineSpendRequest = {
  kind: 'spend-request',
  id: 's1',
  slug: 'codex',
  virtualModel: 'fast',
};

const credentialed: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://api.anthropic.com',
  spend: { custody: 'credentialed', credential },
};

function refusingPort(reason: string) {
  return {
    postMessage: (): never => {
      throw new Error(reason);
    },
  };
}

function recordingPort() {
  const posted: EngineSpendGrant[] = [];

  return {
    posted,
    postMessage: (grant: EngineSpendGrant): void => {
      posted.push(grant);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a lane that will not carry the grant', () => {
  test('a port that refuses the grant is written down rather than left to carry out', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    answerSpendRequest(
      refusingPort('DataCloneError'),
      async () => Promise.resolve(credentialed),
      asked,
    );

    await vi.waitFor(() => {
      expect(complaint).toHaveBeenCalled();
    });

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('codex');
    expect(spoken).toContain('fast');
  });

  test('the complaint about a refusing port carries no credential', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    answerSpendRequest(
      refusingPort('DataCloneError'),
      async () => Promise.resolve(credentialed),
      asked,
    );

    await vi.waitFor(() => {
      expect(complaint).toHaveBeenCalled();
    });

    expect(complaint.mock.calls.flat().map(String).join(' ')).not.toContain(credential);
  });
});

describe('a lane that carries the grant', () => {
  test('the grant reaches the port answering the request that drew it', async () => {
    const port = recordingPort();

    answerSpendRequest(port, async () => Promise.resolve(credentialed), asked);

    await vi.waitFor(() => {
      expect(port.posted).toStrictEqual([
        { kind: 'spend-grant', answers: 's1', grant: credentialed },
      ]);
    });
  });
});
