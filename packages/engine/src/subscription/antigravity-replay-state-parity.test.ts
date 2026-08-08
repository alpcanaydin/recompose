import { expect, test } from 'vitest';

import { AntigravityReasoningReplay } from './antigravity-replay';

test('TestAntigravityReasoningReplayConditionalMutationRejectsStaleLocalSnapshot', () => {
  const replay = seeded('old');
  const stale = replay.stateSnapshot('scope');

  replay.commit('scope', [item('new')]);

  expect(replay.replaceIfUnchanged('scope', stale, [item('stale')])).toBe(false);
  expect(replay.deleteIfUnchanged('scope', stale)).toBe(false);
  expect(signature(replay)).toBe('new');
});

test('TestAntigravityReasoningReplayNonPrefixReplaceRotatesLocalBranch', () => {
  const replay = seeded('old');
  const first = replay.stateSnapshot('scope');
  const stale = replay.stateSnapshot('scope');

  expect(replay.replaceIfUnchanged('scope', first, [item('new')])).toBe(true);
  expect(replay.replaceIfUnchanged('scope', stale, [item('new'), item('latest')])).toBe(false);
});

test('TestAntigravityReasoningReplayConditionalReplaceAcceptsDescendantLocalChain', () => {
  const replay = seeded('prefix');
  const stale = replay.stateSnapshot('scope');
  const first = replay.stateSnapshot('scope');

  expect(replay.replaceIfUnchanged('scope', first, [item('prefix'), item('middle')])).toBe(true);
  expect(
    replay.replaceIfUnchanged('scope', stale, [item('prefix'), item('middle'), item('latest')]),
  ).toBe(true);
  expect(replay.snapshot('scope')).toHaveLength(3);
});

test('TestAntigravityReasoningReplayDescendantMergeRejectsResetBranchABA', () => {
  const replay = seeded('A');
  const stale = replay.stateSnapshot('scope');

  replay.commit('scope', [item('B')]);
  replay.commit('scope', [item('A')]);

  expect(replay.replaceIfUnchanged('scope', stale, [item('A'), item('late')])).toBe(false);
});

test('TestAntigravityReasoningReplayConditionalDeleteTombstoneBlocksStaleFirstWriter', () => {
  const replay = new AntigravityReasoningReplay();
  const stale = replay.stateSnapshot('scope');
  const clear = replay.stateSnapshot('scope');

  expect(replay.deleteIfUnchanged('scope', clear)).toBe(true);
  expect(replay.replaceIfUnchanged('scope', stale, [item('stale')])).toBe(false);
});

test('TestAntigravityReasoningReplayEvictedTombstoneStillBlocksStaleFirstWriter', () => {
  const replay = new AntigravityReasoningReplay();
  const stale = replay.stateSnapshot('scope');
  const clear = replay.stateSnapshot('scope');

  replay.deleteIfUnchanged('scope', clear);
  replay.evictOldestForTest(1);

  expect(replay.replaceIfUnchanged('scope', stale, [item('stale')])).toBe(false);
});

test('TestAntigravityReasoningReplayUnrelatedEvictionDoesNotBlockAbsentSnapshot', () => {
  const replay = new AntigravityReasoningReplay();

  replay.commit('older', [item('live')]);
  const absent = replay.stateSnapshot('untouched');

  replay.evictOldestForTest(1);
  expect(replay.replaceIfUnchanged('untouched', absent, [item('first')])).toBe(true);
});

test('TestAntigravityReasoningReplayLocalTombstonesStayWithinEntryBound', () => {
  const replay = new AntigravityReasoningReplay();

  for (let index = 0; index <= 4096; index += 1) replay.clear(`scope-${String(index)}`);

  expect(replay.entryCount()).toBeLessThanOrEqual(4096);
});

test('TestAntigravityReasoningReplayLocalAbsenceReservationsStayWithinEntryBound', () => {
  const replay = new AntigravityReasoningReplay();
  let latest = '';

  for (let index = 0; index <= 4096; index += 1) {
    latest = `scope-${String(index)}`;
    replay.stateSnapshot(latest);
  }

  expect(replay.entryCount()).toBeLessThanOrEqual(4096);
  expect(replay.stateSnapshot(latest).found).toBe(false);
});

function item(value: string) {
  return { id: '', name: '', args: {}, text: value, signature: value };
}

function seeded(value: string): AntigravityReasoningReplay {
  const replay = new AntigravityReasoningReplay();

  replay.commit('scope', [item(value)]);

  return replay;
}

function signature(replay: AntigravityReasoningReplay): string | undefined {
  return replay.snapshot('scope').at(-1)?.signature;
}
