import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { installFakeBridge } from '../shared/testing';
import { AppDevtools } from './devtools';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

async function renderDevtools() {
  installFakeBridge();

  return render(<AppDevtools router={createAppRouter({ queryClient: createQueryClient() })} />);
}

test('every devtools panel answers to one trigger rather than one each', async () => {
  const screen = await renderDevtools();

  await expect
    .element(screen.getByRole('button', { name: 'Open TanStack Devtools' }))
    .toBeVisible();
});

test('the trigger keeps clear of the sidebar, the toolbar, and the foot of the shell', async () => {
  const screen = await renderDevtools();

  const trigger = screen.getByRole('button', { name: 'Open TanStack Devtools' });

  await expect.element(trigger).toBeVisible();

  const box = trigger.element().getBoundingClientRect();

  expect(box.left).toBeGreaterThan(window.innerWidth / 2);
  expect(box.top).toBeGreaterThan(window.innerHeight / 4);
  expect(box.bottom).toBeLessThan((window.innerHeight * 3) / 4);
});

test('a surface painted over the whole window still leaves the trigger pressable', async () => {
  installFakeBridge();

  const screen = await render(
    <>
      <div className="fixed inset-0" />
      <AppDevtools router={createAppRouter({ queryClient: createQueryClient() })} />
    </>,
  );

  const trigger = screen.getByRole('button', { name: 'Open TanStack Devtools' });

  await expect.element(trigger).toBeVisible();

  const box = trigger.element().getBoundingClientRect();
  const pressed = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);

  expect(trigger.element().contains(pressed)).toBe(true);
});

test('the one trigger opens on a press and offers both the router and the cache', async () => {
  const screen = await renderDevtools();

  await screen.getByRole('button', { name: 'Open TanStack Devtools' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Router' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'React Query' })).toBeVisible();
});
