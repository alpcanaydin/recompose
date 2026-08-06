import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { panelBounds } from './panel-resize';
import { PanelSeparator } from './panel-separator';

const bounds = panelBounds.inspector;

type Settled = { widths: number[]; collapses: number };

async function renderSeparator(side: 'leading' | 'trailing', width = 320) {
  const settled: Settled = { widths: [], collapses: 0 };

  const screen = await render(
    <PanelSeparator
      bounds={bounds}
      label="Inspector width"
      onCollapse={() => {
        settled.collapses += 1;
      }}
      onResize={(asked) => {
        settled.widths.push(asked);
      }}
      side={side}
      width={width}
    />,
  );

  return { screen, settled };
}

const theSeparator = { name: 'Inspector width' };

function dragTo(handle: Element, from: number, to: number) {
  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: from, bubbles: true }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: to }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: to }));
}

test('the separator says how wide the panel stands and how wide it may stand', async () => {
  const { screen } = await renderSeparator('leading');
  const handle = screen.getByRole('separator', theSeparator);

  await expect.element(handle).toHaveAttribute('aria-valuenow', '320');
  await expect.element(handle).toHaveAttribute('aria-valuemin', String(bounds.min));
  await expect.element(handle).toHaveAttribute('aria-valuemax', String(bounds.max));
  await expect.element(handle).toHaveAttribute('aria-orientation', 'vertical');
});

test('dragging a trailing panel outward widens it', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  dragTo(screen.getByRole('separator', theSeparator).element(), 500, 540);

  expect(settled.widths.at(-1)).toBe(360);
});

test('dragging a leading panel inward widens it, because it grows the other way', async () => {
  const { screen, settled } = await renderSeparator('leading');

  dragTo(screen.getByRole('separator', theSeparator).element(), 500, 460);

  expect(settled.widths.at(-1)).toBe(360);
});

test('a drag never sizes the panel past the widest it may stand', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  dragTo(screen.getByRole('separator', theSeparator).element(), 500, 2000);

  expect(settled.widths.at(-1)).toBe(bounds.max);
});

test('a drag well past the narrowest width shuts the panel rather than slivering it', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  dragTo(screen.getByRole('separator', theSeparator).element(), 500, 100);

  expect(settled.collapses).toBe(1);
});

test('a drag carrying on past the collapse shuts the panel once and leaves it shut', async () => {
  const { screen, settled } = await renderSeparator('trailing');
  const handle = screen.getByRole('separator', theSeparator).element();

  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 500, bubbles: true }),
  );

  for (const at of [400, 300, 200, 100, 40]) {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: at }));
  }

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 40 }));

  expect(settled.collapses).toBe(1);
  expect(settled.widths).toEqual([bounds.min]);
});

test('arrow keys size the panel a step at a time', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{ArrowRight}');

  expect(settled.widths.at(-1)).toBe(320 + bounds.step);

  await userEvent.keyboard('{ArrowLeft}');

  expect(settled.widths.at(-1)).toBe(320 - bounds.step);
});

test('Home and End reach the two widths the panel may stand at', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{Home}');

  expect(settled.widths.at(-1)).toBe(bounds.min);

  await userEvent.keyboard('{End}');

  expect(settled.widths.at(-1)).toBe(bounds.max);
});

test('Enter shuts the panel, so a keyboard reaches the collapse a drag makes', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{Enter}');

  expect(settled.collapses).toBe(1);
});
