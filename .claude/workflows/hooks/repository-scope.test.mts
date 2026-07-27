import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { before, describe, it } from 'node:test';

import { REPOSITORY_ROOT, scratchDirectory, worktreeOfRepository } from './format-harness.mts';
import { repositoryDirectories } from './repository-scope.mts';

const NESTED_PATH: readonly string[] = ['apps', 'desktop', 'src'];

let siblingWorktree = '';

let plantedDirectory = '';

before(() => {
  siblingWorktree = worktreeOfRepository('repository-scope-');
  plantedDirectory = scratchDirectory('repository-scope-planted-');
  mkdirSync(join(siblingWorktree, ...NESTED_PATH), { recursive: true });
  mkdirSync(join(plantedDirectory, ...NESTED_PATH), { recursive: true });
});

describe('repository bound: a directory nested inside a worktree of this repository', () => {
  it('reaches every directory from it up to that worktree root', () => {
    const start = join(siblingWorktree, ...NESTED_PATH);

    assert.deepEqual(repositoryDirectories(start, REPOSITORY_ROOT), [
      start,
      join(siblingWorktree, 'apps', 'desktop'),
      join(siblingWorktree, 'apps'),
      siblingWorktree,
    ]);
  });

  it('stops at that worktree root and never reaches the directory holding it', () => {
    const reachable = repositoryDirectories(join(siblingWorktree, ...NESTED_PATH), REPOSITORY_ROOT);

    assert.equal(reachable.includes(dirname(siblingWorktree)), false);
  });
});

describe('repository bound: a directory that no worktree of this repository holds', () => {
  it('reaches nothing at all', () => {
    const start = join(plantedDirectory, ...NESTED_PATH);

    assert.deepEqual(repositoryDirectories(start, REPOSITORY_ROOT), []);
  });
});

describe('repository bound: a directory inside a worktree that nobody has created yet', () => {
  it('still stops at that worktree root', () => {
    const start = join(siblingWorktree, 'packages', 'contracts', 'src');

    assert.deepEqual(repositoryDirectories(start, REPOSITORY_ROOT), [
      start,
      join(siblingWorktree, 'packages', 'contracts'),
      join(siblingWorktree, 'packages'),
      siblingWorktree,
    ]);
  });
});
