const consequence = 'Clients holding the old token stop connecting.';
const copied = 'Copied.';

const couldNotCopy = 'The value could not be copied.';

export const couldNotMint = 'The value could not be minted.';
export const couldNotRead = 'The credential store could not be read, so the token is out of reach.';

type TokenRowActivity = {
  confirming: boolean;
  copied: boolean;
  copyFailed: boolean;
  mintFailed: boolean;
};

export function tokenRowStatus(activity: TokenRowActivity): {
  status?: string;
  statusTone?: 'alert' | 'note';
} {
  if (activity.confirming) {
    return { status: consequence };
  }

  if (activity.mintFailed) {
    return { status: couldNotMint };
  }

  if (activity.copyFailed) {
    return { status: couldNotCopy };
  }

  return activity.copied ? { status: copied, statusTone: 'note' } : {};
}
