import { localRuntimeAddresses } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import { probeRuntimeUntilTheHostAnswers } from './probe-runtime-until-the-host-answers';

describe('the stand-in that answers while no host can take a look', () => {
  test('every address reads as unreachable, because no look has been taken at all', async () => {
    for (const address of [localRuntimeAddresses.ollama, 'http://127.0.0.1:1234']) {
      await expect(probeRuntimeUntilTheHostAnswers(address)).resolves.toEqual({
        verdict: 'unreachable',
      });
    }
  });

  test('the reading claims no version and no status, because nothing answered to claim one', async () => {
    const reading = await probeRuntimeUntilTheHostAnswers(localRuntimeAddresses.ollama);

    expect(reading).not.toHaveProperty('version');
    expect(reading).not.toHaveProperty('status');
  });
});
