import { describe, expect, test } from 'vitest';

import { addSchemaHint, mergedSchemaHint } from './antigravity-schema-hints';

describe('merging a constraint hint into a schema description', () => {
  test('a schema without a description takes the hint as its description', () => {
    expect(mergedSchemaHint(undefined, 'format: email')).toBe('format: email');
  });

  test('an empty description takes the hint as its description', () => {
    expect(mergedSchemaHint('', 'format: email')).toBe('format: email');
  });

  test('a description that already is the hint stays as it is', () => {
    expect(mergedSchemaHint('format: email', 'format: email')).toBe('format: email');
  });

  test('a description that already carries the hint stays as it is', () => {
    expect(mergedSchemaHint('the address (format: email)', 'format: email')).toBe(
      'the address (format: email)',
    );
  });

  test('a fresh hint joins an existing description in parentheses', () => {
    expect(mergedSchemaHint('the address', 'format: email')).toBe('the address (format: email)');
  });
});

describe('adding a constraint hint to a schema', () => {
  test('the hint lands on the description of the schema', () => {
    const schema = { type: 'string', description: 'the address' };

    addSchemaHint(schema, 'format: email');

    expect(schema.description).toBe('the address (format: email)');
  });
});
