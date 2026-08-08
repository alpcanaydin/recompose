import { describe, expect, test } from 'vitest';

import { flattenedSchemaUnion } from './antigravity-schema-unions';

describe('Antigravity schema union flattening', () => {
  test('a schema without a union stays as it is', () => {
    expect(flattenedSchemaUnion({ type: 'string' })).toBeNull();
  });

  test('a union whose members are not schemas cannot be flattened', () => {
    expect(flattenedSchemaUnion({ anyOf: ['string', 7] })).toBeNull();
  });

  test('an object member outranks a scalar member of the same union', () => {
    const flattened = flattenedSchemaUnion({
      oneOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' } } }],
    });

    expect(flattened).toMatchObject({ type: 'object', properties: { id: { type: 'string' } } });
  });

  test('a list member outranks a scalar member of the same union', () => {
    const flattened = flattenedSchemaUnion({
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    });

    expect(flattened).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  test('a null member never wins over a scalar member', () => {
    const flattened = flattenedSchemaUnion({ anyOf: [{ type: 'null' }, { type: 'string' }] });

    expect(flattened).toMatchObject({ type: 'string' });
  });
});

describe('a flattened Antigravity union records what it accepted', () => {
  test('the accepted member types are recorded on the flattened schema', () => {
    const flattened = flattenedSchemaUnion({
      anyOf: [{ type: 'string' }, { type: 'object', properties: {} }],
    });

    expect(flattened?.['description']).toBe('Accepts: string | object');
  });

  test('a member without a declared type contributes no accepted type', () => {
    const flattened = flattenedSchemaUnion({
      anyOf: [{ description: 'anything', properties: {} }, { type: 'string' }],
    });

    expect(flattened?.['description']).toBe('anything');
  });

  test('the union description merges into the flattened member description', () => {
    const flattened = flattenedSchemaUnion({
      description: 'the identifier',
      anyOf: [{ type: 'string', description: 'text form' }, { type: 'integer' }],
    });

    expect(flattened?.['description']).toBe(
      'text form (the identifier) (Accepts: string | integer)',
    );
  });

  test('flattening never hands back the member the union held', () => {
    const member = { type: 'object', properties: { id: { type: 'string' } } };
    const flattened = flattenedSchemaUnion({ anyOf: [member] });

    expect(flattened).not.toBe(member);
    expect(flattened).toEqual(member);
  });
});
