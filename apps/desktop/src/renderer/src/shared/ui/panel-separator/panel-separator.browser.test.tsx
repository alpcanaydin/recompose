import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { panelBounds } from '../../lib';
import { PanelSeparator } from './panel-separator';

const bounds = panelBounds.inspector;

type Settled = { widths: number[]; collapses: number; restores: number; kept: number };

async function renderSeparator(panelEdge: 'leading' | 'trailing', width = 320, shut = false) {
  const settled: Settled = { widths: [], collapses: 0, restores: 0, kept: 0 };

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
      onRestore={() => {
        settled.restores += 1;
      }}
      onSettled={() => {
        settled.kept += 1;
      }}
      panelEdge={panelEdge}
      shut={shut}
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
  await expect.element(handle).toHaveAttribute('aria-valuemin', '0');
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

test('a shut panel is announced as shut, never as the width it will come back at', async () => {
  const { screen } = await renderSeparator('trailing', 320, true);

  await expect
    .element(screen.getByRole('separator', theSeparator))
    .toHaveAttribute('aria-valuenow', '0');
});

test('dragging out of a shut panel brings it back rather than doing nothing', async () => {
  const { screen, settled } = await renderSeparator('trailing', 320, true);

  dragTo(screen.getByRole('separator', theSeparator).element(), 0, bounds.collapseBelow + 20);

  expect(settled.restores).toBe(1);
  expect(settled.widths).toEqual([]);
});

test('a nudge on a shut panel leaves it shut, so a stray pointer never reopens it', async () => {
  const { screen, settled } = await renderSeparator('trailing', 320, true);

  dragTo(screen.getByRole('separator', theSeparator).element(), 0, 4);

  expect(settled.restores).toBe(0);
});

test('dragging further out of a panel that came back stops asking, having been answered', async () => {
  const { screen, settled } = await renderSeparator('trailing', 320, true);
  const handle = screen.getByRole('separator', theSeparator).element();

  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, bubbles: true }),
  );

  for (const at of [60, 120, 240, 400]) {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: at }));
  }

  expect(settled.restores).toBe(1);
});

test('Enter brings a shut panel back, so the one key both shuts it and returns it', async () => {
  const { screen, settled } = await renderSeparator('trailing', 320, true);

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{Enter}');

  expect(settled.restores).toBe(1);
  expect(settled.collapses).toBe(0);
});

test('the arrow that would grow a shut panel brings it back instead', async () => {
  const { screen, settled } = await renderSeparator('trailing', 320, true);

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{ArrowRight}');

  expect(settled.restores).toBe(1);

  await userEvent.keyboard('{ArrowLeft}');

  expect(settled.restores).toBe(1);
});

test('a shut leading panel comes back on the arrow that grows it, which points the other way', async () => {
  const { screen, settled } = await renderSeparator('leading', 320, true);

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{ArrowLeft}');

  expect(settled.restores).toBe(1);

  await userEvent.keyboard('{ArrowRight}');

  expect(settled.restores).toBe(1);
});

test('the panel a person is dragging keeps its settled width to itself until the drag ends', async () => {
  const { screen, settled } = await renderSeparator('trailing');
  const handle = screen.getByRole('separator', theSeparator).element();

  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 500, bubbles: true }),
  );

  for (const at of [510, 520, 530]) {
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: at }));
  }

  expect(settled.widths).toHaveLength(3);
  expect(settled.kept).toBe(0);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 530 }));

  expect(settled.kept).toBe(1);
});

test('a leading panel grows toward the leading edge from the keyboard too', async () => {
  const { screen, settled } = await renderSeparator('leading');

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{ArrowLeft}');

  expect(settled.widths.at(-1)).toBe(320 + bounds.step);
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

test('a key the separator has no answer for leaves the panel exactly as it stands', async () => {
  const { screen, settled } = await renderSeparator('trailing');

  screen.getByRole('separator', theSeparator).element().focus();
  await userEvent.keyboard('{Escape}');

  expect(settled.widths).toEqual([]);
  expect(settled.collapses).toBe(0);
  expect(settled.kept).toBe(0);
});

test('a second pointer moving never sizes the panel the first one is dragging', async () => {
  const { screen, settled } = await renderSeparator('trailing');
  const handle = screen.getByRole('separator', theSeparator).element();

  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 500, bubbles: true }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 700 }));

  expect(settled.widths).toEqual([]);
});

test('a second pointer lifting never ends the drag the first one is making', async () => {
  const { screen, settled } = await renderSeparator('trailing');
  const handle = screen.getByRole('separator', theSeparator).element();

  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: 500, bubbles: true }),
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: 700 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 540 }));

  expect(settled.kept).toBe(0);
  expect(settled.widths).toEqual([360]);
});
