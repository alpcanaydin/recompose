import { describe, expect, test } from 'vitest';

import { readParentPort } from './parent-port';

const aPort = { postMessage: () => undefined, on: () => undefined };

describe('finding the port that carries directives', () => {
  test('a utility process hands over the parent port it carries', () => {
    expect(readParentPort({ parentPort: aPort })).toBe(aPort);
  });

  test('a process carrying no parent port fails, naming what the child needs', () => {
    expect(() => readParentPort({})).toThrow(/utility process/);
  });

  test('a parent port that is no object at all fails the same way', () => {
    expect(() => readParentPort({ parentPort: 'a port, honest' })).toThrow(/utility process/);
  });

  test('an absent parent port fails the same way', () => {
    expect(() => readParentPort({ parentPort: null })).toThrow(/utility process/);
  });
});
