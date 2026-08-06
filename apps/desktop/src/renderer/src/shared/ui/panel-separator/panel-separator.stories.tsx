import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { panelBounds } from './panel-resize';
import { PanelSeparator } from './panel-separator';

const bounds = panelBounds.inspector;

function SizedPanel({ standing }: { standing: number }) {
  const [width, setWidth] = useState(standing);
  const [shut, setShut] = useState(false);

  return (
    <div className="flex h-40 w-160 bg-surface-content">
      <div className="flex-1" />
      {shut ? null : (
        <PanelSeparator
          bounds={bounds}
          label="Inspector width"
          onCollapse={() => {
            setShut(true);
          }}
          onResize={setWidth}
          side="leading"
          width={width}
        />
      )}
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
    side: 'leading' as const,
    onResize: () => {},
    onCollapse: () => {},
  },
  render: (standing) => <SizedPanel standing={standing.width} />,
});

/**
 * The panel at the narrowest width its content still reads at.
 *
 * @summary The minimum is where the endpoint row still holds one line, so a person can drag this
 * far and lose nothing. Below it the panel shuts rather than becoming a sliver.
 */
export const Narrowest = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('separator', { name: 'Inspector width' })).toHaveAttribute(
      'aria-valuenow',
      String(bounds.min),
    );
  },
});

/** The panel at the width it ships with, which is where a person meets it. */
export const Standing = meta.story({ args: { width: 304 } });

/** The panel at the widest it may stand, past which the drag stops rather than fighting. */
export const Widest = meta.story({ args: { width: bounds.max } });

/** Sizing it from the keyboard, which the separator carries the whole splitter pattern for. */
export const SizedByKeyboard = meta.story({
  args: { width: 304 },
  play: async ({ canvas, userEvent }) => {
    const handle = await canvas.findByRole('separator', { name: 'Inspector width' });

    handle.focus();
    await userEvent.keyboard('{End}');

    await expect(handle).toHaveAttribute('aria-valuenow', String(bounds.max));
  },
});

/** The separator in the dark scheme, where the border it sits on has to stay findable. */
export const DarkScheme = meta.story({ args: { width: 304 }, globals: { theme: 'dark' } });
