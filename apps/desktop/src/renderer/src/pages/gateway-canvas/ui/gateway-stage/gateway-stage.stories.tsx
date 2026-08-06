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
 * The stage as it stands before the canvas exists: the dotted field and the gateway on it.
 *
 * @summary The field carries the gateway and nothing else. Prose explaining that the canvas is
 * unfinished told a person nothing they could act on, so the surface says what it holds and stops.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('My Gateway')).toBeVisible();
    await expect(await canvas.findByText(':8397 · 2 virtual models')).toBeVisible();
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
 * The stage squeezed to the narrowest the window allows, where the node keeps the leading edge.
 *
 * @summary An empty field invites recentring the one thing on it, and that would move the node
 * every time a second one arrived. It stays where the field will fill from, so the reading measures
 * the node against the field's own leading edge rather than against the room around it.
 */
export const NarrowStage = meta.story({
  decorators: [
    (Story) => (
      <div className="flex h-100 w-105 bg-surface-content">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const node = await canvas.findByRole('button', { name: /My Gateway/ });
    const field = canvasElement.querySelector('section');

    await expect(paintedBox(node).left - paintedBox(field).left).toBeLessThan(32);
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
