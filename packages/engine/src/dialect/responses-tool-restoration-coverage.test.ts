import { describe, expect, test } from 'vitest';

import { customToolInput, responseToolRef } from './responses-tool-restoration';

describe('reading the free-form input a custom tool call carries', () => {
  test('arguments that are not JSON pass through as the input', () => {
    expect(customToolInput('SELECT 1;')).toBe('SELECT 1;');
  });

  test('arguments that parse to something other than an object carry no input', () => {
    expect(customToolInput('[1,2]')).toBe('');
  });

  test('an object without an input field carries no input', () => {
    expect(customToolInput('{"query":"hello"}')).toBe('');
  });

  test('an object with an input field yields that input', () => {
    expect(customToolInput('{"input":"SELECT 1;"}')).toBe('SELECT 1;');
  });
});

describe('matching a provider tool call back to the tool the caller declared', () => {
  test('a named call resolves against the declared name', () => {
    expect(responseToolRef('search', { search: { kind: 'custom', name: 'search' } })).toEqual({
      kind: 'custom',
      name: 'search',
    });
  });

  test('an unnamed call resolves when exactly one tool was declared', () => {
    expect(responseToolRef(undefined, { search: { kind: 'custom', name: 'search' } })).toEqual({
      kind: 'custom',
      name: 'search',
    });
  });

  test('an empty name resolves when exactly one tool was declared', () => {
    expect(responseToolRef('', { search: { kind: 'custom', name: 'search' } })).toEqual({
      kind: 'custom',
      name: 'search',
    });
  });

  test('an unnamed call stays ambiguous when two tools were declared', () => {
    expect(
      responseToolRef(undefined, {
        search: { kind: 'custom', name: 'search' },
        fetch: { kind: 'custom', name: 'fetch' },
      }),
    ).toBeUndefined();
  });
});
