import { spawn } from 'node:child_process';

const MISSING_COMMAND = 2;

const command =
  process.platform === 'win32' ? process.env['RECOMPOSE_SIGN_IN_COMMAND'] : process.argv[2];

if (command === undefined || command === '') {
  process.stderr.write('the fake terminal needs the sign-in command\n');
  process.exit(MISSING_COMMAND);
}

if (process.platform === 'win32') {
  spawn(
    'powershell',
    ['-NoProfile', '-Command', '& ([ScriptBlock]::Create($env:RECOMPOSE_SIGN_IN_COMMAND))'],
    { stdio: 'ignore' },
  );
} else {
  spawn('sh', ['-c', command], { detached: true, stdio: 'ignore' }).unref();
}
