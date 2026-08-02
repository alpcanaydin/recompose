import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { Chip } from './chip';

function KindFilter() {
  const [selected, setSelected] = useState(false);

  return (
    <Chip onSelectedChange={setSelected} selected={selected}>
      Subscriptions
    </Chip>
  );
}

test('a chip nobody picked announces that it stands unselected', async () => {
  await render(<KindFilter />);

  await expect
    .element(page.getByRole('button', { name: 'Subscriptions', pressed: false }))
    .toBeVisible();
});

test('picking a chip asks for the selected state', async () => {
  await render(<KindFilter />);

  await page.getByRole('button', { name: 'Subscriptions' }).click();

  await expect
    .element(page.getByRole('button', { name: 'Subscriptions', pressed: true }))
    .toBeVisible();
});

test('picking a selected chip asks to give the state back', async () => {
  await render(<KindFilter />);

  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await page.getByRole('button', { name: 'Subscriptions', pressed: true }).click();

  await expect
    .element(page.getByRole('button', { name: 'Subscriptions', pressed: false }))
    .toBeVisible();
});
