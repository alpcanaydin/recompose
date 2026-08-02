import { KeychainDenied, type KeychainItem, type KeychainSeam } from './credential-custody';
import { runCommand, WAITS_FOR_THE_PERSON } from './run-command';

const PRESENCE_BOUND_MS = 3_000;
const NOT_FOUND = 44;
const USER_CANCELED = 128;
const AUTHORIZATION_DENIED = 51;

function exitStatus(cause: unknown): number | null {
  if (!(cause instanceof Error) || !('code' in cause)) {
    return null;
  }

  return typeof cause.code === 'number' ? cause.code : null;
}

function refuseOrRethrow(cause: unknown, operation: string): never {
  const status = exitStatus(cause);

  if (status === USER_CANCELED || status === AUTHORIZATION_DENIED) {
    throw new KeychainDenied(`the keychain prompt was denied while recompose ran ${operation}`);
  }

  throw cause;
}

async function itemStands(command: string, item: KeychainItem): Promise<boolean> {
  try {
    await runCommand(
      command,
      ['find-generic-password', '-s', item.service, '-a', item.account],
      PRESENCE_BOUND_MS,
    );

    return true;
  } catch (cause) {
    if (exitStatus(cause) === NOT_FOUND) {
      return false;
    }

    return refuseOrRethrow(cause, 'find-generic-password');
  }
}

export function securityKeychain(command: string): KeychainSeam {
  return {
    stands: async (item: KeychainItem) => itemStands(command, item),

    read: async (item: KeychainItem) => {
      try {
        const found = await runCommand(
          command,
          ['find-generic-password', '-s', item.service, '-a', item.account, '-w'],
          WAITS_FOR_THE_PERSON,
        );

        return found.replace(/\n$/, '');
      } catch (cause) {
        if (exitStatus(cause) === NOT_FOUND) {
          return null;
        }

        return refuseOrRethrow(cause, 'find-generic-password');
      }
    },

    write: async (item: KeychainItem, blob: string) => {
      try {
        await runCommand(
          command,
          ['add-generic-password', '-U', '-s', item.service, '-a', item.account, '-w', blob],
          WAITS_FOR_THE_PERSON,
        );
      } catch (cause) {
        refuseOrRethrow(cause, 'add-generic-password');
      }
    },

    remove: async (item: KeychainItem) => {
      try {
        await runCommand(
          command,
          ['delete-generic-password', '-s', item.service, '-a', item.account],
          WAITS_FOR_THE_PERSON,
        );
      } catch (cause) {
        if (exitStatus(cause) === NOT_FOUND) {
          return;
        }

        refuseOrRethrow(cause, 'delete-generic-password');
      }
    },
  };
}
