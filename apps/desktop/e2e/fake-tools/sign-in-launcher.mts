import { spawn } from 'node:child_process';

const MISSING_COMMAND = 2;

function shellFor(command: string): { binary: string; argv: string[] } {
  return process.platform === 'win32'
    ? { binary: 'powershell', argv: ['-NoProfile', '-Command', command] }
    : { binary: 'sh', argv: ['-c', command] };
}

const command = process.argv[2];

if (command === undefined || command === '') {
  process.stderr.write('the fake terminal needs the sign-in command as its only argument\n');
  process.exit(MISSING_COMMAND);
}

const { binary, argv } = shellFor(command);

spawn(binary, argv, { detached: true, stdio: 'ignore' }).unref();
