import { runCommand } from './run-command';

const pathAssignment = 'PATH=';

export type LoginShellProbe = {
  shell: string | undefined;
  environmentPath: string;
  platform: NodeJS.Platform;
  boundMs: number;
};

function pathInsideEnvironmentReport(report: string): string | null {
  const assigned = report.split('\n').find((line) => line.startsWith(pathAssignment));

  if (assigned === undefined) {
    return null;
  }

  const carried = assigned.slice(pathAssignment.length);

  return carried === '' ? null : carried;
}

async function askTheLoginShell(shell: string, boundMs: number): Promise<string | null> {
  try {
    return pathInsideEnvironmentReport(await runCommand(shell, ['-lc', 'env'], boundMs));
  } catch {
    return null;
  }
}

export async function loginShellPath(probe: LoginShellProbe): Promise<string> {
  if (probe.platform === 'win32' || probe.shell === undefined || probe.shell === '') {
    return probe.environmentPath;
  }

  return (await askTheLoginShell(probe.shell, probe.boundMs)) ?? probe.environmentPath;
}
