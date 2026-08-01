import type { AccountsDocument } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { withSidebarSurface } from '#.storybook/sidebar-surface';

import type { AccountKind } from '../../../../entities/account';

import { paintedBox, paintedStyle } from '../../../../shared/testing';
import { ProviderSidebar } from './provider-sidebar';

function stored(kinds: AccountKind[]): AccountsDocument {
  return {
    schemaVersion: 2,
    accounts: kinds.map((kind, index) =>
      kind === 'subscription'
        ? { id: `a${index}`, provider: 'anthropic' as const, kind, label: `Account ${index}` }
        : {
            id: `a${index}`,
            provider: 'anthropic',
            kind,
            label: `Account ${index}`,
            credentialRef: `c${index}`,
          },
    ),
  };
}

const meta = preview.meta({
  component: ProviderSidebar,
  parameters: { bridge: { accounts: stored([]) } },
  decorators: [withSidebarSurface],
});

/** The three kinds before any account is connected, where every count reads zero honestly. */
export const NothingConnected = meta.story({
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('link', { name: 'Subscriptions, 0 connected' }),
    ).toBeVisible();
    await expect(await canvas.findByRole('link', { name: 'API Keys, 0 connected' })).toBeVisible();
    await expect(
      await canvas.findByRole('link', { name: 'Aggregators, 0 connected' }),
    ).toBeVisible();
  },
});

/** Counts standing apart, so the badge reads as a number rather than as part of the name. */
export const CountsPerKind = meta.story({
  parameters: { bridge: { accounts: stored(['api-key', 'api-key', 'subscription']) } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'API Keys, 2 connected' })).toBeVisible();
    await expect(
      await canvas.findByRole('link', { name: 'Subscriptions, 1 connected' }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole('link', { name: 'Aggregators, 0 connected' }),
    ).toBeVisible();
  },
});

/**
 * The counts standing on the same trailing line the state marks hold in the group above.
 *
 * @summary The sidebar has one trailing column, and a reader takes in the whole of it at once,
 * so a count that stopped short of that line would read as a ragged edge.
 */
export const CountsHoldTheTrailingLine = meta.story({
  parameters: { bridge: { accounts: stored(['api-key', 'api-key', 'subscription']) } },
  play: async ({ canvas, canvasElement }) => {
    const row = await canvas.findByRole('link', { name: 'API Keys, 2 connected' });
    const surface = canvasElement.firstElementChild;

    for (const kind of ['Subscriptions, 1 connected', 'Aggregators, 0 connected']) {
      const other = await canvas.findByRole('link', { name: kind });

      await expect(paintedBox(other.lastElementChild).right).toBe(
        paintedBox(row.lastElementChild).right,
      );
    }

    await expect(paintedBox(row.lastElementChild).right).toBe(paintedBox(surface).right - 18);
  },
});

/**
 * Each glyph carrying its own tint, measured against the surface it is painted on.
 *
 * @summary A tint that marks one row apart from another is a graphical object, so it answers to
 * the 3 to 1 floor. The reference's yellow reads 2.65 to 1 in light, which is why this build
 * paints a darker one there.
 */
export const TintsClearTheFloor = meta.story({
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('link', { name: 'API Keys, 0 connected' });

    const surface = paintedStyle(canvasElement.firstElementChild).backgroundColor;

    for (const name of [
      'Subscriptions, 0 connected',
      'API Keys, 0 connected',
      'Aggregators, 0 connected',
    ]) {
      const glyph = (await canvas.findByRole('link', { name })).querySelector('svg');

      await expect(contrastRatio(paintedStyle(glyph).color, surface)).toBeGreaterThanOrEqual(3);
    }
  },
});

function channel(value: number): number {
  const scaled = value / 255;

  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(paint: string): number {
  const [red = 0, green = 0, blue = 0] = [...paint.matchAll(/[\d.]+/gu)].map((part) =>
    Number(part[0]),
  );

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(paint: string, against: string): number {
  const [darker = 0, lighter = 0] = [luminance(paint), luminance(against)].sort((a, b) => a - b);

  return (lighter + 0.05) / (darker + 0.05);
}

/** The same three tints in the dark scheme, where each one is a step brighter. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
