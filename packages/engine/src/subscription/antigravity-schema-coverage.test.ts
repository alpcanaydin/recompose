import { describe, expect, it } from 'vitest';

import {
  cleanAntigravityResponseSchema,
  cleanAntigravityToolSchema,
  cleanNestedAntigravityToolSchema,
} from './antigravity-schema';

describe('folding an allOf schema into one object', () => {
  it('should ignore an allOf member that is not a schema', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'object',
      allOf: ['not a schema', 7, { properties: { name: { type: 'string' } } }],
    });

    expect(cleaned).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
  });

  it('should ignore an allOf member that adds no properties', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'object',
      properties: { name: { type: 'string' } },
      allOf: [{ description: 'a note' }],
    });

    expect(cleaned).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
  });

  it('should merge the required names every allOf member insists on', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'object',
      required: ['name', 7],
      allOf: [
        { properties: { name: { type: 'string' } }, required: ['name', 'size'] },
        { properties: { size: { type: 'number' } } },
      ],
    });

    expect(cleaned).toHaveProperty('required', ['name', 'size']);
  });
});

describe('cleaning the children of a schema', () => {
  it('should skip a property whose schema is not an object', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'object',
      properties: { name: { type: 'string' }, broken: 'not a schema' },
      required: ['name', 'broken'],
    });

    expect(cleaned).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
  });

  it('should clean the schema an array declares for its items', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'array',
      items: { type: 'string', $comment: 'internal' },
    });

    expect(cleaned).toEqual({ type: 'array', items: { type: 'string' } });
  });

  it('should leave a union member that is not a schema alone', () => {
    const cleaned = cleanAntigravityResponseSchema({
      anyOf: [{ type: 'string', $comment: 'internal' }, 'literal'],
    });

    expect(cleaned).toEqual({ anyOf: [{ type: 'string' }, 'literal'] });
  });
});

describe('flattening a schema that names several types', () => {
  it('should fall back to text when a schema names no type at all', () => {
    const cleaned = cleanAntigravityResponseSchema({ type: [] });

    expect(cleaned).toEqual({ type: 'string' });
  });

  it('should keep the first type and note the rest for the reader', () => {
    const cleaned = cleanAntigravityResponseSchema({ type: ['string', 'number'] });

    expect(cleaned).toEqual({ type: 'string', description: 'Accepts: string | number' });
  });
});

describe('reading a schema that points elsewhere', () => {
  it('should name the definition a reference points at', () => {
    const cleaned = cleanAntigravityResponseSchema({ $ref: '#/$defs/Widget' });

    expect(cleaned).toEqual({ type: 'object', description: 'See: Widget' });
  });

  it('should tell the reader that no extra properties are welcome', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });

    expect(cleaned).toEqual({
      type: 'object',
      properties: {},
      description: 'No extra properties allowed',
    });
  });
});

describe('placeholders for nested Antigravity tool schemas', () => {
  it('should give a nested object with no required name something to require', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };

    expect(cleanNestedAntigravityToolSchema(schema)).toHaveProperty('required', ['_']);
    expect(cleanAntigravityToolSchema(schema)).not.toHaveProperty('required');
  });
});
