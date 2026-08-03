import type { AccountsDocument } from '@recompose/contracts';

import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';
import { withSidebarSurface } from '#.storybook/sidebar-surface';

import { paintedBox, paintedStyle } from '../../../../../shared/testing';
import { ProviderSidebar } from './provider-sidebar';

type StoredKind = AccountsDocument['accounts'][number]['kind'];

function stored(kinds: StoredKind[]): AccountsDocument {
  return {
    schemaVersion: 3,
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

const rows = [
  'Subscriptions, 0 connected',
  'API Keys, 0 connected',
  'Aggregators, 0 connected',
  'Local Runtimes, 0 connected',
];

/** The four kinds before any account is connected, where every count reads zero honestly. */
export const NothingConnected = meta.story({
  play: async ({ canvas }) => {
    for (const name of rows) {
      await expect(await canvas.findByRole('link', { name })).toBeVisible();
    }
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
    const surface = canvasElement.querySelector('aside');

    for (const kind of ['Subscriptions, 1 connected', 'Local Runtimes, 0 connected']) {
      const other = await canvas.findByRole('link', { name: kind });

      await expect(paintedBox(other.lastElementChild).right).toBe(
        paintedBox(row.lastElementChild).right,
      );
    }

    await expect(paintedBox(row.lastElementChild).right).toBe(paintedBox(surface).right - 18);
  },
});

/**
 * Each glyph carrying its own tint, measured composited onto what actually lies beneath it.
 *
 * @summary A tint that marks one row apart from another is a graphical object, so it answers to
 * the 3 to 1 floor. The reference's yellow reads 2.65 to 1 in light, which is why this build
 * paints a darker one there. The sidebar surface and the muted tint both carry alpha, so the
 * reading flattens every layer down to the first opaque one rather than trusting a declaration.
 */
export const TintsClearTheFloor = meta.story({
  play: async ({ canvas }) => {
    for (const name of rows) {
      const row = await canvas.findByRole('link', { name });

      await waitFor(async () => {
        await expect(
          contrastRatio(paintedStyle(row.querySelector('svg')).color, backdropOf(row)),
        ).toBeGreaterThanOrEqual(3);
      });
    }
  },
});

type Paint = readonly [number, number, number, number];

function parsePaint(paint: string): Paint {
  const [red = 0, green = 0, blue = 0, alpha = 1] = [...paint.matchAll(/[\d.]+/gu)].map((part) =>
    Number(part[0]),
  );

  return [red, green, blue, alpha];
}

function laidOver(top: Paint, under: Paint): Paint {
  const [red, green, blue, alpha] = top;
  const [underRed, underGreen, underBlue] = under;

  return [
    red * alpha + underRed * (1 - alpha),
    green * alpha + underGreen * (1 - alpha),
    blue * alpha + underBlue * (1 - alpha),
    1,
  ];
}

function backdropOf(node: Element | null): Paint {
  if (node === null) {
    return parsePaint(paintedStyle(document.documentElement).backgroundColor);
  }

  const paint = parsePaint(paintedStyle(node).backgroundColor);

  return paint[3] === 1 ? paint : laidOver(paint, backdropOf(node.parentElement));
}

function channel(value: number): number {
  const scaled = value / 255;

  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Paint): number {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(paint: string, against: Paint): number {
  const composited = luminance(laidOver(parsePaint(paint), against));
  const [darker = 0, lighter = 0] = [composited, luminance(against)].sort((a, b) => a - b);

  return (lighter + 0.05) / (darker + 0.05);
}

/** The same three tints in the dark scheme, where each one is a step brighter. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
