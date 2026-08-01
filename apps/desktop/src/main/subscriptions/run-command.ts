import { execFile } from 'node:child_process';

export const WAITS_FOR_THE_PERSON = 0;

export async function runCommand(
  command: string,
  args: readonly string[],
  boundMs: number,
): Promise<string> {
  return new Promise((carry, refuse) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', timeout: boundMs, windowsHide: true },
      (failure, stdout) => {
        if (failure === null) {
          carry(stdout);

          return;
        }

        refuse(failure instanceof Error ? failure : new Error(`${command} failed`));
      },
    );
  });
}
