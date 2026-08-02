import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import type { CredentialCustody, CustodyOutcome } from './credential-custody';

import {
  credentialCustody,
  PARKED_SERVICE,
  RESERVED_SLOT,
  VENDOR_SERVICE,
} from './credential-custody';
import {
  fakeKeychain,
  osUser,
  parkedUnder,
  refusalIn,
  vendorHolding,
} from './subscriptions.testkit';

async function refusalFrom(
  seeded: Record<string, string>,
  atStep: number,
  work: (custody: CredentialCustody) => Promise<CustodyOutcome>,
): Promise<{ code: string; message: string }> {
  const keychain = fakeKeychain(seeded, { atStep, kind: 'failed' });

  return refusalIn(await work(credentialCustody(keychain.seam, osUser)));
}

describe('parking the credential the provider tool keeps in the keychain', () => {
  test('given a credential in the vendor item, parking copies it under the account it belongs to', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.park('acc-one');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBe('opaque-one');
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('opaque-one');
  });

  test('given no credential in the vendor item, parking leaves the slot empty rather than blank', async () => {
    const keychain = fakeKeychain();
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.park('acc-one');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.holds(PARKED_SERVICE, 'acc-one')).toBe(false);
    expect(keychain.writes()).toBe(0);
    await expect(custody.parkedStands('acc-one')).resolves.toBe(false);
  });

  test('given the person denies the keychain prompt, parking stops before any write', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'), { atStep: 1, kind: 'denied' });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.park('acc-one');

    expect(outcome).toMatchObject({ ok: false, code: 'keychain-denied' });
    expect(refusalIn(outcome).message).toContain('park');
    expect(keychain.writes()).toBe(0);
  });

  test('given the keychain fails for its own reasons, parking answers a storage refusal', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'), { atStep: 1, kind: 'failed' });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.park('acc-one');

    expect(outcome).toMatchObject({ ok: false, code: 'storage-failed' });
    expect(refusalIn(outcome).message).toContain('park');
  });

  test('given a refusal, the message never repeats the credential it was handling', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'), { atStep: 2, kind: 'failed' });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.park('acc-one');

    expect(JSON.stringify(outcome)).not.toContain('opaque-one');
  });
});

describe('placing a parked credential back where the tool looks for it', () => {
  test('given a parked credential, placing puts it in the vendor item', async () => {
    const keychain = fakeKeychain({
      ...vendorHolding('opaque-one'),
      ...parkedUnder('acc-two', 'opaque-two'),
    });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.place('acc-two');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('opaque-two');
  });

  test('given nothing parked for the account, placing empties the vendor item rather than leaving a stranger there', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.place('acc-two');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.holds(VENDOR_SERVICE, osUser)).toBe(false);
  });
});

describe('handing the vendor item from one account to another', () => {
  test('given both accounts, the outgoing credential is parked and the incoming one takes its place', async () => {
    const keychain = fakeKeychain({
      ...vendorHolding('opaque-one'),
      ...parkedUnder('acc-two', 'opaque-two'),
    });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.handOver('acc-one', 'acc-two');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBe('opaque-one');
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('opaque-two');
  });

  test('given nobody was active, the outgoing credential parks under the reserved slot', async () => {
    const keychain = fakeKeychain({
      ...vendorHolding('someone-elses-login'),
      ...parkedUnder('acc-two', 'opaque-two'),
    });
    const custody = credentialCustody(keychain.seam, osUser);

    await custody.handOver(null, 'acc-two');

    expect(keychain.blobAt(PARKED_SERVICE, RESERVED_SLOT)).toBe('someone-elses-login');
  });

  test('given the person denies the prompt, the hand-over stops before any write', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'), { atStep: 1, kind: 'denied' });
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.handOver('acc-one', 'acc-two');

    expect(outcome).toMatchObject({ ok: false, code: 'keychain-denied' });
    expect(refusalIn(outcome).message).toContain('park');
    expect(keychain.writes()).toBe(0);
  });
});

describe('a custody refusal names the step it could not finish', () => {
  test('given the keychain fails while placing, the refusal names placing and the account', async () => {
    const refused = await refusalFrom(parkedUnder('acc-two', 'opaque-two'), 1, async (custody) =>
      custody.place('acc-two'),
    );

    expect(refused.message).toContain('place');
    expect(refused.message).toContain('acc-two');
  });

  test('given the keychain fails while letting go, the refusal names forgetting', async () => {
    const refused = await refusalFrom(parkedUnder('acc-one', 'opaque-one'), 1, async (custody) =>
      custody.forget('acc-one'),
    );

    expect(refused.message).toContain('forget');
  });

  test('given the keychain fails while emptying the vendor item, the refusal names clearing', async () => {
    const refused = await refusalFrom(vendorHolding('opaque-one'), 1, async (custody) =>
      custody.clear(),
    );

    expect(refused.message).toContain('clear');
    expect(refused.message).toContain('the active account');
  });

  test('given the keychain fails as the hand-over places, the refusal names placing', async () => {
    const refused = await refusalFrom(
      { ...vendorHolding('opaque-one'), ...parkedUnder('acc-two', 'opaque-two') },
      3,
      async (custody) => custody.handOver('acc-one', 'acc-two'),
    );

    expect(refused.message).toContain('place');
  });
});

describe('the hand-over never loses the credential it was carrying', () => {
  test.prop([
    fc.uniqueArray(
      fc.uuid().map((id) => `acc-${id}`),
      { minLength: 2, maxLength: 2 },
    ),
    fc.integer({ min: 1, max: 6 }),
    fc.constantFrom('denied' as const, 'failed' as const),
  ])(
    'given any pair of accounts and any single point of failure, the outgoing credential is never lost',
    async (pair, atStep, kind) => {
      const outgoing = pair[0] ?? 'acc-one';
      const incoming = pair[1] ?? 'acc-two';
      const keychain = fakeKeychain(
        { ...vendorHolding('outgoing-blob'), ...parkedUnder(incoming, 'incoming-blob') },
        { atStep, kind },
      );
      const custody = credentialCustody(keychain.seam, osUser);

      await custody.handOver(outgoing, incoming);

      const stillRecoverable =
        keychain.blobAt(VENDOR_SERVICE, osUser) === 'outgoing-blob' ||
        keychain.blobAt(PARKED_SERVICE, outgoing) === 'outgoing-blob';

      expect(stillRecoverable).toBe(true);
    },
  );
});

describe('letting go of a credential when an account leaves', () => {
  test('given an account being removed, its parked credential goes with it', async () => {
    const keychain = fakeKeychain(parkedUnder('acc-one', 'opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.forget('acc-one');

    expect(outcome).toEqual({ ok: true });
    expect(keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBeNull();
  });

  test('given the active account being removed, the vendor item is emptied too', async () => {
    const keychain = fakeKeychain(vendorHolding('opaque-one'));
    const custody = credentialCustody(keychain.seam, osUser);

    const outcome = await custody.clear();

    expect(outcome).toEqual({ ok: true });
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBeNull();
  });
});

describe('custody runs one turn at a time', () => {
  test('given two hand-overs asked for together, the second reads what the first left', async () => {
    const keychain = fakeKeychain({
      ...vendorHolding('opaque-one'),
      ...parkedUnder('acc-two', 'opaque-two'),
      ...parkedUnder('acc-three', 'opaque-three'),
    });
    const custody = credentialCustody(keychain.seam, osUser);

    await Promise.all([
      custody.handOver('acc-one', 'acc-two'),
      custody.handOver('acc-two', 'acc-three'),
    ]);

    expect(keychain.blobAt(PARKED_SERVICE, 'acc-one')).toBe('opaque-one');
    expect(keychain.blobAt(PARKED_SERVICE, 'acc-two')).toBe('opaque-two');
    expect(keychain.blobAt(VENDOR_SERVICE, osUser)).toBe('opaque-three');
  });
});
