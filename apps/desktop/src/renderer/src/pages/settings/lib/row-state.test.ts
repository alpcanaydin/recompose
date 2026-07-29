import { describe, expect, it } from 'vitest';

import { launchAtLoginRow, revealLabelFor } from './row-state';

describe('the reveal action names the file browser the platform ships', () => {
  it('names Finder where the platform ships Finder', () => {
    expect(revealLabelFor('finder')).toBe('Reveal in Finder');
  });

  it('names Explorer where the platform ships Explorer', () => {
    expect(revealLabelFor('explorer')).toBe('Show in Explorer');
  });

  it('names neither where the platform ships its own file manager', () => {
    expect(revealLabelFor('file-manager')).toBe('Open folder');
  });
});

describe('the launch-at-login row tells absent apart from unavailable', () => {
  it('never renders where the platform will never support a login item', () => {
    expect(launchAtLoginRow('unsupported').rendered).toBe(false);
  });

  it('renders and moves where the operating system offers a login item', () => {
    expect(launchAtLoginRow('available')).toEqual({ rendered: true, inert: false });
  });

  it('renders inert and names the development build where the app runs unpackaged', () => {
    const row = launchAtLoginRow('unpackaged');

    expect(row.rendered).toBe(true);
    expect(row.inert).toBe(true);
    expect(row.reason).toMatch(/development build/i);
  });
});
