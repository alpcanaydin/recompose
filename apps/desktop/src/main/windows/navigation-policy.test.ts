import { describe, expect, test } from 'vitest';

import {
  decideExternalOpen,
  isAllowedNavigation,
  type NavigationPolicy,
} from './navigation-policy';

const devPolicy: NavigationPolicy = { devServerOrigin: 'http://localhost:5173' };
const prodPolicy: NavigationPolicy = { devServerOrigin: undefined };

describe('in-window navigation policy', () => {
  test('navigation to the app scheme is allowed', () => {
    expect(isAllowedNavigation('app://renderer/settings', prodPolicy)).toBe(true);
  });

  test('navigation to the dev server is allowed when configured', () => {
    expect(isAllowedNavigation('http://localhost:5173/settings', devPolicy)).toBe(true);
  });

  test('navigation to a foreign origin is denied', () => {
    expect(isAllowedNavigation('https://evil.example.com', prodPolicy)).toBe(false);
  });

  test('a malformed target is denied', () => {
    expect(isAllowedNavigation('not a url', prodPolicy)).toBe(false);
  });
});

describe('external-open policy', () => {
  test('an https link opens externally', () => {
    expect(decideExternalOpen('https://recompose.sh')).toBe('open-https');
  });

  test('a non-https link is dropped', () => {
    expect(decideExternalOpen('http://recompose.sh')).toBe('drop');
  });

  test('a javascript scheme target is dropped', () => {
    expect(decideExternalOpen('javascript:alert(1)')).toBe('drop');
  });

  test('a malformed target is dropped', () => {
    expect(decideExternalOpen('not a url')).toBe('drop');
  });
});
