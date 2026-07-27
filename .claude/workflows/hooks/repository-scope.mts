import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

type RepositoryPlacement = {
  readonly commonDirectory: string;
  readonly depthBelowRoot: number;
};

type ProbePoint = {
  readonly directory: string;
  readonly distance: number;
};

const PLACEMENT_QUERY: readonly string[] = [
  'rev-parse',
  '--path-format=absolute',
  '--git-common-dir',
  '--show-prefix',
];

function countSegments(prefix: string): number {
  return prefix.split('/').filter((segment) => segment.length > 0).length;
}

function placeInRepository(directory: string): RepositoryPlacement | undefined {
  const run = spawnSync('git', [...PLACEMENT_QUERY], { cwd: directory, encoding: 'utf8' });

  if (run.status !== 0) {
    return undefined;
  }

  const [commonDirectory, prefix] = run.stdout.split('\n');

  if (commonDirectory === undefined || prefix === undefined) {
    return undefined;
  }

  return { commonDirectory, depthBelowRoot: countSegments(prefix) };
}

function nearestExistingAncestor(start: string): ProbePoint | undefined {
  let directory = start;
  let distance = 0;

  while (!existsSync(directory)) {
    const parent = dirname(directory);

    if (parent === directory) {
      return undefined;
    }

    directory = parent;
    distance += 1;
  }

  return { directory, distance };
}

function ancestorsUpTo(start: string, levels: number): readonly string[] {
  const directories = [start];
  let directory = start;

  for (let step = 0; step < levels; step += 1) {
    directory = dirname(directory);
    directories.push(directory);
  }

  return directories;
}

export function repositoryDirectories(start: string, anchor: string): readonly string[] {
  const probe = nearestExistingAncestor(start);

  if (probe === undefined) {
    return [];
  }

  const placement = placeInRepository(probe.directory);
  const anchorPlacement = placeInRepository(anchor);

  if (placement === undefined || anchorPlacement === undefined) {
    return [];
  }

  if (placement.commonDirectory !== anchorPlacement.commonDirectory) {
    return [];
  }

  return ancestorsUpTo(start, probe.distance + placement.depthBelowRoot);
}
