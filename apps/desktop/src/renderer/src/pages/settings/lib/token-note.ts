import type { GatewayTokenStatus } from '@recompose/contracts';

import { couldNotMint, couldNotRead } from './token-status';

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

type RequirementReport = {
  token: GatewayTokenStatus | null;
  refused: boolean;
  mintRefused: boolean;
};

export function tokenOrNothing(
  answered: { ok: true; value: GatewayTokenStatus } | { ok: false },
): GatewayTokenStatus | null {
  return answered.ok ? answered.value : null;
}

export function tokenRequirementReason(report: RequirementReport): string | undefined {
  if (report.token === null) {
    return couldNotRead;
  }

  if (report.mintRefused) {
    return couldNotMint;
  }

  return tokenRequirementNote(report.token.storage, report.refused);
}

export type RequirementDecision = 'refuse' | 'save' | 'save-and-mint';

export function tokenRequirementDecision(
  token: GatewayTokenStatus | null,
  required: boolean,
): RequirementDecision {
  if (token === null) {
    return 'refuse';
  }

  if (!required) {
    return 'save';
  }

  if (token.storage === 'unavailable') {
    return 'refuse';
  }

  return token.masked === null ? 'save-and-mint' : 'save';
}
