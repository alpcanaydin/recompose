import { userInfo } from 'node:os';

import type { SubscriptionsIpcContext } from '../ipc/subscriptions-ipc';
import type { CredentialCustody } from './credential-custody';

import { credentialCustody } from './credential-custody';
import { loginShellPath } from './login-shell-path';
import { securityKeychain } from './macos-keychain';
import { terminalSignInLaunch } from './sign-in-launch';
import { wallClock } from './subscription-sign-in';

const SIGN_IN_BOUND_MS = 5 * 60 * 1000;
const SIGN_IN_EVERY_MS = 1_000;
const LOGIN_SHELL_BOUND_MS = 3_000;
const SECURITY_COMMAND = '/usr/bin/security';

export type SubscriptionsWiring = {
  userDataPath: string;
  homeFolder: string;
  custody: CredentialCustody | null;
  onCorrupt: (quarantinedPath: string) => void;
};

export function machineCustody(): CredentialCustody | null {
  return process.platform === 'darwin'
    ? credentialCustody(securityKeychain(SECURITY_COMMAND), userInfo().username)
    : null;
}

async function toolSearchPath(): Promise<string> {
  return loginShellPath({
    shell: process.env['SHELL'],
    environmentPath: process.env['PATH'] ?? '',
    platform: process.platform,
    boundMs: LOGIN_SHELL_BOUND_MS,
  });
}

export function subscriptionsContext(wiring: SubscriptionsWiring): SubscriptionsIpcContext {
  return {
    userDataPath: wiring.userDataPath,
    homeFolder: wiring.homeFolder,
    platform: process.platform,
    custody: wiring.custody,
    searchPath: toolSearchPath,
    launch: terminalSignInLaunch(
      process.platform,
      process.env['RECOMPOSE_SIGN_IN_LAUNCHER'] ?? null,
    ),
    clock: wallClock,
    signInBoundMs: SIGN_IN_BOUND_MS,
    signInEveryMs: SIGN_IN_EVERY_MS,
    onCorrupt: wiring.onCorrupt,
  };
}
