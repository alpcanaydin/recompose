import { beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { panelBounds } from '../../shared/lib';
import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const bounds = panelBounds.sidebar;

const theEdge = { name: 'Sidebar width' };

function pressAt(handle: Element, at: number) {
  handle.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, clientX: at, bubbles: true }),
  );
}

function moveTo(at: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: at }));
}

function letGoAt(at: number) {
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: at }));
}

function reaches(settings: Element): boolean {
  if (!(settings instanceof HTMLElement)) {
    return false;
  }

  settings.focus();

  return document.activeElement === settings;
}

beforeEach(() => {
  localStorage.clear();
});

test('the edge stays where the sidebar was once the sidebar has gone', async () => {
  const screen = await renderAt('/', { gateways: [codex] });
  const edge = screen.getByRole('separator', theEdge);

  edge.element().focus();
  await userEvent.keyboard('{Enter}');

  await expect.element(edge).toBeInTheDocument();
  await expect.element(edge).toHaveAttribute('aria-valuenow', '0');
});

test('Enter on the edge brings a shut sidebar back, which is how it went away', async () => {
  const screen = await renderAt('/', { gateways: [codex] });
  const edge = screen.getByRole('separator', theEdge);

  edge.element().focus();
  await userEvent.keyboard('{Enter}');

  expect(reaches(screen.getByRole('link', { name: 'Settings' }).element())).toBe(false);

  await userEvent.keyboard('{Enter}');

  expect(reaches(screen.getByRole('link', { name: 'Settings' }).element())).toBe(true);
});

test('dragging the edge out of a shut sidebar brings it back at the width it had', async () => {
  const screen = await renderAt('/', { gateways: [codex] });
  const edge = screen.getByRole('separator', theEdge);

  edge.element().focus();
  await userEvent.keyboard('{End}');
  await userEvent.keyboard('{Enter}');

  pressAt(edge.element(), 0);
  moveTo(bounds.collapseBelow + 20);
  letGoAt(bounds.collapseBelow + 20);

  await expect
    .poll(() => reaches(screen.getByRole('link', { name: 'Settings' }).element()))
    .toBe(true);
  await expect.element(edge).toHaveAttribute('aria-valuenow', String(bounds.max));
});

test('a drag writes the width down when it ends, rather than once a frame', async () => {
  const screen = await renderAt('/', { gateways: [codex] });
  const edge = screen.getByRole('separator', theEdge).element();
  const wrote = vi.spyOn(localStorage, 'setItem');

  pressAt(edge, 240);
  moveTo(250);
  moveTo(260);
  moveTo(270);

  expect(wrote).not.toHaveBeenCalled();

  letGoAt(270);

  expect(wrote).toHaveBeenCalledTimes(1);
});

test('a width stored outside what the panel may stand at comes back inside it', async () => {
  localStorage.setItem('recompose.panel.width.sidebar', String(bounds.max + 4000));

  const screen = await renderAt('/', { gateways: [codex] });

  await expect
    .element(screen.getByRole('separator', theEdge))
    .toHaveAttribute('aria-valuenow', String(bounds.max));
});
