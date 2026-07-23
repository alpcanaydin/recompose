import { defaultAccountsDocument, defaultSettings } from '@recompose/contracts';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { initializeStorage } from './initialize-storage';

describe('storage boot', () => {
  test('first launch creates the layout and yields defaults', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'recompose-userdata-'));

    const state = await initializeStorage(userData, () => undefined);

    expect(state).toEqual({
      settings: defaultSettings(),
      accounts: defaultAccountsDocument(),
      gateways: [],
    });
    expect(await readdir(userData)).toContain('gateways');
  });
});
