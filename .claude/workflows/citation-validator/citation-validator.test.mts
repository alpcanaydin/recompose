import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CodeMapEntry } from './citation-validator.mts';

import { validate } from './citation-validator.mts';

function entry(overrides: Partial<CodeMapEntry>): CodeMapEntry {
  return {
    path: 'src/widget.ts',
    symbols: [],
    layer: 'features',
    note: 'a fixture entry',
    ...overrides,
  };
}

describe('citation validator: a citation naming a path the repository lacks', () => {
  it('fails and names the missing path', () => {
    const verdict = validate([entry({ path: 'src/ghost.ts' })], () => null);

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/ghost.ts');
    assert.match(failure.reason, /src\/ghost\.ts/);
  });
});

describe('citation validator: a citation naming a symbol the file lacks', () => {
  it('fails and names the missing symbol', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['renderWidget'] })],
      () => 'export function paintWidget() {}',
    );

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/widget.ts');
    assert.equal(failure.symbol, 'renderWidget');
    assert.match(failure.reason, /renderWidget/);
  });

  it('does not match a symbol that only appears as a substring of a longer token', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['foo'] })],
      () => 'export function foobar() {}',
    );

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.symbol, 'foo');
  });
});

describe('citation validator: a symbol whose edge character is punctuation', () => {
  it('matches every punctuation-edged symbol without a false failure', () => {
    const verdict = validate(
      [
        entry({
          path: 'package.json',
          symbols: ['@recompose/contracts', '--fail-on-warnings', '#total', 'results$', '$state'],
        }),
      ],
      () =>
        [
          '"@recompose/contracts": "workspace:*"',
          'oxlint --fail-on-warnings',
          'const #total = 0;',
          'export const results$ = [];',
          'let $state = 0;',
        ].join('\n'),
    );

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });
});

describe('citation validator: a symbol containing regex metacharacters', () => {
  it('matches the literal text rather than being interpreted as a pattern', () => {
    const verdict = validate(
      [entry({ path: 'src/store.ts', symbols: ['useStore('] })],
      () => 'export function useStore() { return useStore(); }',
    );

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });
});

describe('citation validator: an entry whose path and every symbol resolve', () => {
  it('passes with no failures', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['renderWidget', 'WidgetProps'] })],
      () => 'export type WidgetProps = {};\nexport function renderWidget(props: WidgetProps) {}',
    );

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });

  it('passes an entry citing no symbols as long as its path resolves', () => {
    const verdict = validate([entry({ path: 'src/widget.ts', symbols: [] })], () => 'anything');

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });
});

describe('citation validator: a missing path with several cited symbols', () => {
  it('reports the path once rather than once per symbol', () => {
    const verdict = validate(
      [entry({ path: 'src/ghost.ts', symbols: ['renderWidget', 'WidgetProps', 'paintWidget'] })],
      () => null,
    );

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/ghost.ts');
    assert.equal('symbol' in failure, false);
  });
});

describe('citation validator: a read that fails after the path is found', () => {
  it('fails with a reason naming the read failure, not a missing path', () => {
    const verdict = validate([entry({ path: 'src/widget-slice' })], () => {
      throw new Error('EISDIR: illegal operation on a directory');
    });

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/widget-slice');
    assert.doesNotMatch(failure.reason, /not found/);
  });
});
