import { describe, expect, test } from 'vitest';

import { homeRelative } from './home-relative';

describe('a folder on its way to the screen', () => {
  test('the home directory the process actually has becomes the shorthand', () => {
    expect(homeRelative('/Users/ada/Library/Application Support/recompose', '/Users/ada')).toBe(
      '~/Library/Application Support/recompose',
    );
  });

  test('a home root no naming convention predicts is still shortened', () => {
    expect(homeRelative('/var/home/ada/.config/recompose', '/var/home/ada')).toBe(
      '~/.config/recompose',
    );
    expect(homeRelative('/export/home/ada/.config/recompose', '/export/home/ada')).toBe(
      '~/.config/recompose',
    );
  });

  test('a Windows profile becomes the shorthand with its own separator', () => {
    expect(
      homeRelative(String.raw`C:\Users\ada\AppData\Roaming\recompose`, String.raw`C:\Users\ada`),
    ).toBe(String.raw`~\AppData\Roaming\recompose`);
  });

  test('a sibling folder that merely starts with the home text stays whole', () => {
    expect(homeRelative('/Users/ada-backup/notes', '/Users/ada')).toBe('/Users/ada-backup/notes');
  });

  test('a folder outside the home directory stays whole', () => {
    expect(homeRelative('/opt/recompose', '/Users/ada')).toBe('/opt/recompose');
  });
});
