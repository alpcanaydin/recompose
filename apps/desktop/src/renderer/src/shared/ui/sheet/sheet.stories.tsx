import type { ComponentProps } from 'react';

import { useRef, useState } from 'react';
import { expect, screen } from 'storybook/test';

import preview from '#.storybook/preview';

import { Sheet } from '../index';

const meta = preview.meta({
  component: Sheet,
});

function GatewaySheet(args: ComponentProps<typeof Sheet>) {
  const nameField = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(args.open);
  const [name, setName] = useState('');

  return (
    <Sheet {...args} initialFocus={nameField} onOpenChange={setOpen} open={open}>
      <label className="flex flex-col gap-1 text-body text-ink">
        Name
        <input
          className="field-control focus-ring"
          onInput={(event) => {
            setName(event.currentTarget.value);
          }}
          ref={nameField}
          value={name}
        />
      </label>
    </Sheet>
  );
}

/** A form that interrupts the surface behind it, over a scrim that dims what it covers. */
export const Open = meta.story({
  args: {
    open: true,
    title: 'Create a gateway',
    description: 'Name it and pick the port it serves on.',
    footer: (
      <>
        <button className="push-button" type="button">
          Cancel
        </button>
        <button className="push-button-primary" type="button">
          Create Gateway
        </button>
      </>
    ),
    onOpenChange: () => {},
    children: null,
  },
  render: GatewaySheet,
  play: async () => {
    const sheet = await screen.findByRole('dialog', { name: 'Create a gateway' });

    await expect(sheet).toHaveAccessibleDescription('Name it and pick the port it serves on.');
    await expect(await screen.findByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(await screen.findByRole('button', { name: 'Create Gateway' })).toBeVisible();
  },
});
