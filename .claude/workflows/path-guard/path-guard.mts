import { execFileSync } from 'node:child_process';

type Verdict = {
  status: 'pass' | 'fail';
  offendingPaths: readonly string[];
  reason: string;
};

const REVIEWED_STATUS_CONTEXT = 'feature-cycle/reviewed';

const BLAST_RADIUS_GLOBS: readonly string[] = [
  'apps/desktop/src/main/**',
  'apps/desktop/src/preload/**',
  'apps/desktop/src/main/storage/**',
  'packages/contracts/**',
  '.github/workflows/**',
  '.claude/workflows/**',
  'package.json',
  'apps/*/package.json',
  'packages/*/package.json',
];

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*\*|\*/g, (match) => (match === '**' ? '.*' : '[^/]*'));

  return new RegExp(`^${pattern}$`);
}

const blastRadiusMatchers: readonly RegExp[] = BLAST_RADIUS_GLOBS.map(globToRegExp);

function isBlastRadiusPath(path: string): boolean {
  return blastRadiusMatchers.some((matcher) => matcher.test(path));
}

function buildFailureReason(offendingPaths: readonly string[]): string {
  const list = offendingPaths.map((path) => `  ${path}`).join('\n');

  return [
    `blast-radius paths changed without the ${REVIEWED_STATUS_CONTEXT} status on the head commit:`,
    list,
    'run the review-pr heavy adversarial review pass to post the status and clear this guard.',
  ].join('\n');
}

export function evaluate(
  changedPaths: readonly string[],
  statusContexts: readonly string[] | null,
): Verdict {
  const offendingPaths = changedPaths.filter(isBlastRadiusPath);

  if (offendingPaths.length === 0) {
    return { status: 'pass', offendingPaths, reason: 'no blast-radius paths changed' };
  }

  if ((statusContexts ?? []).includes(REVIEWED_STATUS_CONTEXT)) {
    return {
      status: 'pass',
      offendingPaths,
      reason: 'blast-radius change carries the review marker',
    };
  }

  return { status: 'fail', offendingPaths, reason: buildFailureReason(offendingPaths) };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`path-guard requires the ${name} environment variable`);
  }

  return value;
}

function readChangedPaths(baseSha: string, headSha: string): string[] {
  const output = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
    encoding: 'utf8',
  });

  return output.split('\n').filter((line) => line.length > 0);
}

function readStatusContexts(repo: string, headSha: string): string[] {
  const output = execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      `repos/${repo}/commits/${headSha}/statuses`,
      '--jq',
      '.[] | select(.state == "success") | .context',
    ],
    { encoding: 'utf8' },
  );

  return output.split('\n').filter((line) => line.length > 0);
}

function main(): void {
  const baseSha = requireEnv('BASE_SHA');
  const headSha = requireEnv('HEAD_SHA');
  const repo = requireEnv('REPO');
  const changedPaths = readChangedPaths(baseSha, headSha);
  const offendingPaths = changedPaths.filter(isBlastRadiusPath);
  const statusContexts = offendingPaths.length > 0 ? readStatusContexts(repo, headSha) : [];
  const verdict = evaluate(changedPaths, statusContexts);

  if (verdict.status === 'fail') {
    console.error(verdict.reason);
    process.exit(1);
  }

  console.log(`path guard passed: ${verdict.reason}`);
}

if (import.meta.main) {
  main();
}
