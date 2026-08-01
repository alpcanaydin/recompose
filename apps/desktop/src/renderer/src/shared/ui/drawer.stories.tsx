import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { Drawer } from './index';

const meta = preview.meta({
  component: Drawer,
  args: {
    open: true,
    title: 'Add a provider',
    onOpenChange: () => {},
    children: null,
  },
});

function CatalogDrawer(args: ComponentProps<typeof Drawer>) {
  const [open, setOpen] = useState(args.open);

  return (
    <div className="h-100">
      <h1 className="text-title text-ink">Subscriptions</h1>
      <p className="mt-2 text-body text-ink-secondary">
        The accounts the provider tools sign in and spend.
      </p>
      <Drawer {...args} onOpenChange={setOpen} open={open}>
        <ul className="flex list-none flex-col gap-1 p-0">
          {['Anthropic', 'OpenAI', 'OpenRouter'].map((provider) => (
            <li className="text-body text-ink" key={provider}>
              {provider}
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  );
}

/** The catalog standing open at the trailing edge, with the screen it came from still behind it. */
export const Open = meta.story({
  render: CatalogDrawer,
  play: async ({ canvasElement }) => {
    const drawer = await screen.findByRole('dialog', { name: 'Add a provider' });
    const behind = canvasElement.querySelector('h1');
    const panel = drawer.getBoundingClientRect();

    await expect(behind?.getBoundingClientRect().height).toBeGreaterThan(0);
    await expect(panel.left).toBeGreaterThan(0);
    await expect(Math.round(panel.right)).toBe(Math.round(window.innerWidth));
    await expect(Math.round(panel.width)).toBe(380);
  },
});

/** The close control at the heading's trailing edge, which hands the screen back on its own. */
export const Closing = meta.story({
  render: CatalogDrawer,
  play: async () => {
    await screen.findByRole('dialog', { name: 'Add a provider' });

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(async () => {
      await expect(screen.queryByRole('dialog', { name: 'Add a provider' })).toBeNull();
    });
  },
});

/** A drawer takes no decision, so it carries a heading and a body and nothing at its foot. */
export const NoFooter = meta.story({
  render: CatalogDrawer,
  play: async () => {
    const drawer = await screen.findByRole('dialog', { name: 'Add a provider' });

    await expect(drawer.querySelector('header')).not.toBeNull();
    await expect(drawer.querySelector('footer')).toBeNull();
  },
});
