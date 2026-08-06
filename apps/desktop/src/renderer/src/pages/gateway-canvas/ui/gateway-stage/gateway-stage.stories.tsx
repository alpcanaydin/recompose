import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { gatewaySeed, paintedBox, paintedStyle } from '../../../../shared/testing';
import { GatewayStage } from './gateway-stage';

const twoDefinitions = ['quick', 'deep'].map((name) => ({
  id: name,
  displayName: name,
  target: { accountId: 'k1', providerModel: `claude-${name}` },
}));

const serving = gatewaySeed({
  slug: 'my-gateway',
  displayName: 'My Gateway',
  port: 8397,
  virtualModels: twoDefinitions,
});

const meta = preview.meta({
  component: GatewayStage,
  args: { gateway: serving, selected: true, onToggleSelected: () => {} },
  decorators: [
    (Story) => (
      <div className="flex h-100 bg-surface-content">
        <Story />
      </div>
    ),
  ],
});

/**
 * The stage as it stands before the canvas exists: the gateway, and where to go instead.
 *
 * @summary The dotted field says nodes belong here and the hint says they do not arrive yet, so a
 * person reads an unfinished surface as unfinished rather than as broken.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('My Gateway')).toBeVisible();
    await expect(await canvas.findByText(':8397 · 2 virtual models')).toBeVisible();
    await expect(await canvas.findByText('Virtual models serve from the drawer')).toBeVisible();
  },
});

/** A gateway serving nothing yet, whose node says so rather than counting to zero. */
export const ServingNothing = meta.story({
  args: {
    gateway: gatewaySeed({ slug: 'my-gateway', displayName: 'My Gateway', port: 8397 }),
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(':8397 · no virtual models yet')).toBeVisible();
  },
});

/**
 * The node with its inspector open, wearing the selection glow.
 *
 * @summary The glow is the one thing on the stage that says which node the drawer is speaking for,
 * so it carries the tinted ring, the soft outer light and the tinted surface together rather than a
 * single hairline a person has to hunt for.
 */
export const Selected = meta.story({
  play: async ({ canvas }) => {
    const node = await canvas.findByRole('button', { name: /My Gateway/ });

    await expect(node).toHaveAttribute('aria-pressed', 'true');
    await expect(paintedStyle(node).boxShadow).toContain('22px');
  },
});

/**
 * The node a person let go of, which is the plain card.
 *
 * @summary With nothing selected the stage takes the whole width, so the deselected node has to
 * read as a control on its own rather than as the leftover of a selected one.
 */
export const Deselected = meta.story({
  args: { selected: false },
  play: async ({ canvas }) => {
    const node = await canvas.findByRole('button', { name: /My Gateway/ });

    await expect(node).toHaveAttribute('aria-pressed', 'false');
    await expect(paintedStyle(node).boxShadow).not.toContain('22px');
  },
});

/**
 * The node under the pointer, which has to say it can be pressed.
 *
 * @summary A card that toggles a whole panel needs an answer to the pointer, so the border takes
 * the accent and the surface warms a little, well short of what the selected glow claims.
 */
export const Hovered = meta.story({
  args: { selected: false },
  play: async ({ canvas }) => {
    const node = await canvas.findByRole('button', { name: /My Gateway/ });
    const resting = paintedStyle(node).borderColor;

    node.setAttribute('data-hovered', '');

    await expect(paintedStyle(node).borderColor).not.toBe(resting);
  },
});

/**
 * The stage squeezed to the narrowest the window allows, where the two blocks must still clear.
 *
 * @summary The node and the hint share a row rather than the centre, so no width can make them
 * cover each other. The reading measures the gap rather than trusting the eye, and the hint takes no
 * pointer of its own, so a click anywhere in that space still reaches the node it was meant for.
 */
export const NarrowStage = meta.story({
  decorators: [
    (Story) => (
      <div className="flex h-100 w-105 bg-surface-content">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const node = await canvas.findByRole('button', { name: /My Gateway/ });
    const hint = await canvas.findByText('Virtual models serve from the drawer');
    const around = hint.parentElement;

    await expect(paintedBox(node).right).toBeLessThanOrEqual(paintedBox(around).left);
    await expect(paintedStyle(around).pointerEvents).toBe('none');
  },
});

/**
 * The dotted field the stage paints, which is what says nodes belong here.
 *
 * @summary The grid moved out of the gateway page and into the stage when the drawer arrived, so
 * the reading that pinned its 22px pitch and its radial dot follows it rather than lapsing.
 */
export const DottedCanvas = meta.story({
  play: async ({ canvasElement }) => {
    const surface = canvasElement.firstElementChild?.firstElementChild;

    await expect(paintedStyle(surface).backgroundSize).toBe('22px 22px');
    await expect(paintedStyle(surface).backgroundImage).toContain('radial-gradient(circle,');
  },
});

/** The stage in the dark scheme, where the dotted field and the node edge both have to read. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
