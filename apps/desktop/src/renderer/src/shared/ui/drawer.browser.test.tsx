import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { Drawer } from './drawer';

function CatalogDrawer() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <h1>Subscriptions</h1>
      <Drawer onOpenChange={setOpen} open={open} title="Add a provider">
        <button type="button">Anthropic</button>
      </Drawer>
    </>
  );
}

test('the drawer carries its heading as the name a screen reader announces', async () => {
  await render(<CatalogDrawer />);

  await expect.element(page.getByRole('dialog', { name: 'Add a provider' })).toBeVisible();
  await expect.element(page.getByRole('heading', { name: 'Add a provider' })).toBeVisible();
});

test('the drawer leaves the surface it opened over standing', async () => {
  const screen = await render(<CatalogDrawer />);

  await expect.element(page.getByRole('dialog', { name: 'Add a provider' })).toBeVisible();

  expect(screen.container.querySelector('h1')).toBeInTheDocument();
});

test('the drawer carries its close control inside the heading rather than at its foot', async () => {
  await render(<CatalogDrawer />);

  await expect.element(page.getByRole('button', { name: 'Close' })).toBeVisible();

  const heading = document.querySelector('.drawer-surface header');

  expect(heading?.querySelector('button')).toHaveAccessibleName('Close');
  expect(document.querySelector('.drawer-surface footer')).toBeNull();
});

test('dismissing the drawer takes it off the screen', async () => {
  await render(<CatalogDrawer />);

  await expect.element(page.getByRole('dialog', { name: 'Add a provider' })).toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect
    .element(page.getByRole('dialog', { name: 'Add a provider' }))
    .not.toBeInTheDocument();
});
