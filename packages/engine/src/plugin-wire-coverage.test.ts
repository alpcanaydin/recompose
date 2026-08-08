import { describe, expect, it } from 'vitest';

import { pluginBytes, pluginHeaders, webHeaders } from './plugin-wire';

describe('plugin payload bytes', () => {
  it('should read a base64 string as the bytes it spells', () => {
    const bytes = pluginBytes(Buffer.from('{"request":true}').toString('base64'));

    expect(new TextDecoder().decode(bytes)).toBe('{"request":true}');
  });

  it('should read a numeric array as the bytes it lists', () => {
    const bytes = pluginBytes([104, 105]);

    expect(new TextDecoder().decode(bytes)).toBe('hi');
  });

  it('should answer no bytes when the array carries a member that is not a number', () => {
    expect(pluginBytes([104, '105'])).toEqual(new Uint8Array());
  });

  it('should answer no bytes when the value is neither a string nor an array', () => {
    expect(pluginBytes({ body: 'hi' })).toEqual(new Uint8Array());
    expect(pluginBytes(null)).toEqual(new Uint8Array());
    expect(pluginBytes(undefined)).toEqual(new Uint8Array());
  });
});

describe('plugin header maps', () => {
  it('should lift a lone string into a single-value list', () => {
    expect(pluginHeaders({ 'x-test': 'one' })).toEqual({ 'x-test': ['one'] });
  });

  it('should keep only the string members of a list value', () => {
    expect(pluginHeaders({ 'x-test': ['one', 2, null, 'two'] })).toEqual({
      'x-test': ['one', 'two'],
    });
  });

  it('should answer an empty list for a value that is neither a string nor a list', () => {
    expect(pluginHeaders({ 'x-test': { nested: true } })).toEqual({ 'x-test': [] });
  });

  it('should answer an empty map when the headers are not an object', () => {
    expect(pluginHeaders(['x-test', 'one'])).toEqual({});
    expect(pluginHeaders('x-test: one')).toEqual({});
    expect(pluginHeaders(null)).toEqual({});
  });
});

describe('plugin headers on the web', () => {
  it('should append every value under its own name', () => {
    const headers = webHeaders({ 'set-cookie': ['first=1', 'second=2'], 'x-test': ['one'] });

    expect(headers.getSetCookie()).toEqual(['first=1', 'second=2']);
    expect(headers.get('x-test')).toBe('one');
  });

  it('should carry no names when the map holds none', () => {
    expect([...webHeaders({}).keys()]).toEqual([]);
  });
});
