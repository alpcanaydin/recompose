import { describe, expect, test } from 'vitest';

import { homeRelative } from './home-relative';

describe('the config folder as a person reads it', () => {
  test('a macOS path loses the home directory', () => {
    expect(homeRelative('/Users/ada/Library/Application Support/recompose')).toBe(
      '~/Library/Application Support/recompose',
    );
  });

  test('a Linux path loses the home directory', () => {
    expect(homeRelative('/home/ada/.config/recompose')).toBe('~/.config/recompose');
  });

  test('a Windows path loses the home directory', () => {
    expect(homeRelative(String.raw`C:\Users\ada\AppData\Roaming\recompose`)).toBe(
      String.raw`~\AppData\Roaming\recompose`,
    );
  });

  test('a path outside any home directory stays whole', () => {
    expect(homeRelative('/opt/recompose')).toBe('/opt/recompose');
  });

  test('the home directory itself reads as the shorthand alone', () => {
    expect(homeRelative('/Users/ada')).toBe('~');
  });

  test('a directory that merely starts like a home directory stays whole', () => {
    expect(homeRelative('/UsersOnly/shared/recompose')).toBe('/UsersOnly/shared/recompose');
  });
});
