import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { panelBounds } from '../../lib';
import { pressedByKeyboard } from '../../testing';
import { PanelSeparator } from './panel-separator';

const bounds = panelBounds.inspector;

function SizedPanel({ standing }: { standing: number }) {
  const [width, setWidth] = useState(standing);
  const [shut, setShut] = useState(false);

  return (
    <div className="flex h-40 w-160 bg-surface-content">
      <div className="flex-1" />
      <PanelSeparator
        bounds={bounds}
        label="Inspector width"
        onCollapse={() => {
          setShut(true);
        }}
        onResize={setWidth}
        onRestore={() => {
          setShut(false);
        }}
        onSettled={() => {}}
        panelEdge="leading"
        shut={shut}
        width={width}
      />
      {shut ? null : (
        <aside
          className="shrink-0 border-s border-line-subtle bg-surface-toolbar p-3"
          style={{ width }}
        >
          <p className="text-caption font-bold text-ink-secondary">Inspector</p>
          <p className="mt-1 font-mono text-mono-value text-ink">{width}px</p>
        </aside>
      )}
    </div>
  );
}

const meta = preview.meta({
  component: PanelSeparator,
  args: {
    label: 'Inspector width',
    width: bounds.min,
    bounds,
    panelEdge: 'leading' as const,
    onResize: () => {},
    onCollapse: () => {},
    onRestore: () => {},
    onSettled: () => {},
  },
  render: (standing) => <SizedPanel standing={standing.width} />,
});

const theSeparator = { role: 'separator', name: 'Inspector width' };

/**
 * The panel at the narrowest width its content still reads at.
 *
 * @summary The minimum is where the endpoint row still holds one line, so a person can drag this
 * far and lose nothing. Below it the panel shuts rather than becoming a sliver.
 */
export const Narrowest = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('separator', { name: theSeparator.name })).toHaveAttribute(
      'aria-valuenow',
      String(bounds.min),
    );
  },
});

/** The panel at the width it ships with, which is where a person meets it. */
export const Standing = meta.story({ args: { width: bounds.standing } });

/** The panel at the widest it may stand, past which the drag stops rather than fighting. */
export const Widest = meta.story({ args: { width: bounds.max } });

/** Sizing it from the keyboard, which the separator carries the whole splitter pattern for. */
export const SizedByKeyboard = meta.story({
  args: { width: bounds.standing },
  play: async ({ canvas, userEvent }) => {
    const handle = await pressedByKeyboard(canvas, theSeparator, userEvent.keyboard, '{End}');

    await expect(handle).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/**
 * The border once the panel behind it has gone, which is the only way back to it.
 *
 * @summary A shut panel has no width, so announcing the one it will come back at would tell a screen
 * reader a panel stands where nothing does. The border stays where the panel's edge was, so the
 * gesture that shut it is the one that returns it.
 */
export const PanelShut = meta.story({
  args: { width: bounds.standing },
  play: async ({ canvas, userEvent }) => {
    const handle = await pressedByKeyboard(canvas, theSeparator, userEvent.keyboard, '{Enter}');

    await expect(canvas.queryByText('Inspector')).toBeNull();
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
  },
});

/**
 * The panel brought back from shut, at the width its owner had chosen.
 *
 * @summary Coming back at the shipped width would throw away a sizing a person meant, so the width
 * outlives the collapse and the one key that shut the panel is the one that returns it.
 */
export const PanelRestored = meta.story({
  args: { width: bounds.max },
  play: async ({ canvas, userEvent }) => {
    const handle = await pressedByKeyboard(canvas, theSeparator, userEvent.keyboard, '{Enter}');

    await userEvent.keyboard('{Enter}');

    await expect(await canvas.findByText('Inspector')).toBeVisible();
    await expect(handle).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/** The separator in the dark scheme, where the border it sits on has to stay findable. */
export const DarkScheme = meta.story({
  args: { width: bounds.standing },
  globals: { theme: 'dark' },
});
