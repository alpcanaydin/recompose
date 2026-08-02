import { describe, expect, test } from 'vitest';

import { securityKeychain } from './macos-keychain';

const A_SECRET = 'sk-ant-oat01-a-blob-that-must-never-leave-the-keychain';
const item = { service: 'recompose-parked-credentials', account: 'acc-one' };

async function refusalFrom(work: Promise<unknown>): Promise<Error> {
  try {
    await work;
  } catch (cause) {
    return cause instanceof Error ? cause : new Error(String(cause));
  }

  throw new Error('the seam answered where the tool was meant to fail');
}

describe('the security keychain seam', () => {
  test('given the security tool fails, when a credential is written, the refusal never carries the blob', async () => {
    const keychain = securityKeychain(process.execPath);

    const refusal = await refusalFrom(keychain.write(item, A_SECRET));

    expect(refusal.message).not.toContain(A_SECRET);
  });

  test('given the security tool fails, when a credential is written, the refusal names the operation', async () => {
    const keychain = securityKeychain(process.execPath);

    const refusal = await refusalFrom(keychain.write(item, A_SECRET));

    expect(refusal.message).toContain('add-generic-password');
  });
});
