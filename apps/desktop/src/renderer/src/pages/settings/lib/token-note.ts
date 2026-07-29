import type { GatewayTokenStatus } from '@recompose/contracts';

const needsStore = 'recompose cannot store a token without a system credential store.';
const plainText =
  'No system keyring is available, so recompose stores the token in plain text on this machine.';

export function tokenRequirementNote(
  storage: GatewayTokenStatus['storage'],
  refused: boolean,
): string | undefined {
  if (refused) {
    return needsStore;
  }

  return storage === 'plaintext-fallback' ? plainText : undefined;
}
