import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join } from 'node:path';

const VENDOR_SERVICE = 'Claude Code-credentials';
const MISSING_CONFIG_HOME = 2;

const signedInAs = 'dev@example.com';
const plan = 'Max';

const credential = JSON.stringify({
  claudeAiOauth: { accessToken: 'fake-access-token', subscriptionType: plan },
});

const identity = JSON.stringify({
  oauthAccount: { emailAddress: signedInAs },
  subscriptionType: plan,
});

function keychainKeeps(blob: string): void {
  const security = process.env['RECOMPOSE_KEYCHAIN_COMMAND'];

  if (security === undefined || security === '') {
    throw new Error('the fake Claude Code needs RECOMPOSE_KEYCHAIN_COMMAND on macOS');
  }

  const kept = spawnSync(
    security,
    ['add-generic-password', '-U', '-s', VENDOR_SERVICE, '-a', userInfo().username, '-w', blob],
    { stdio: 'inherit' },
  );

  if (kept.status !== 0) {
    throw new Error(`the fake keychain refused the credential with status ${String(kept.status)}`);
  }
}

async function homeKeeps(home: string, blob: string): Promise<void> {
  await writeFile(join(home, '.credentials.json'), blob, 'utf8');
}

const home = process.env['CLAUDE_CONFIG_DIR'];

if (home === undefined || home === '') {
  process.stderr.write('the fake Claude Code needs CLAUDE_CONFIG_DIR\n');
  process.exit(MISSING_CONFIG_HOME);
}

await mkdir(home, { recursive: true });
await writeFile(join(home, '.claude.json'), identity, 'utf8');

if (process.platform === 'darwin') {
  keychainKeeps(credential);
} else {
  await homeKeeps(home, credential);
}
