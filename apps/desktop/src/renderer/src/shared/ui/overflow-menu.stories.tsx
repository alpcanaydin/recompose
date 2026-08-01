import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import preview from '#.storybook/preview';

import { OverflowMenu } from './index';

const meta = preview.meta({
  component: OverflowMenu,
  args: {
    label: 'Claude Max actions',
    items: [
      { label: 'Use this account', onSelect: () => {} },
      { label: 'Sign in again', onSelect: () => {} },
      { label: 'Remove', onSelect: () => {} },
    ],
  },
});

/** The resting control, which names what its actions act on rather than naming itself. */
export const Closed = meta.story({
  play: async ({ canvas }) => {
    const control = await canvas.findByRole('button', { name: 'Claude Max actions' });

    await expect(control).toHaveAttribute('aria-haspopup');
    await expect(control).toHaveAttribute('aria-expanded', 'false');
  },
});

/** Every action the row holds behind the control, in the order the caller gave them. */
export const Opened = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Claude Max actions' }));

    const listed = await screen.findAllByRole('menuitem');

    await expect(listed.map((action) => action.textContent)).toEqual([
      'Use this account',
      'Sign in again',
      'Remove',
    ]);
  },
});

/** Choosing an action runs it and hands the screen straight back. */
export const ActionChosen = meta.story({
  render: (args) => (
    <div className="flex flex-col gap-2">
      <p className="text-body text-ink" id="last-act">
        nothing yet
      </p>
      <OverflowMenu
        items={args.items.map((action) => ({
          label: action.label,
          onSelect: () => {
            const record = document.getElementById('last-act');

            if (record !== null) {
              record.textContent = action.label;
            }
          },
        }))}
        label={args.label}
      />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Claude Max actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    await expect(await within(canvasElement).findByText('Remove')).toBeVisible();

    await waitFor(async () => {
      await expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
    });
  },
});
