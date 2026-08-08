import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { inspectorOpen, showSidebar, sidebarHidden, toggleInspector } from '../../shared/lib';
import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

function pressOn(target: Element) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
}

function theStageBackground(container: HTMLElement): Element {
  const section = container.querySelector('main section');

  if (section === null) {
    throw new Error('the stage is not on screen');
  }

  return section;
}

async function renderGateway() {
  return renderAt('/gateways/codex', { gateways: [codex] });
}

const theEndpoint = { exact: true } as const;

beforeEach(() => {
  localStorage.clear();
  showSidebar();

  if (!inspectorOpen()) {
    toggleInspector();
  }
});

test('a press on the stage behind the drawer puts the inspector away', async () => {
  const screen = await renderGateway();

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();

  pressOn(theStageBackground(screen.container));

  await expect.element(screen.getByText('Endpoint', theEndpoint)).not.toBeInTheDocument();
});

test('a press on the toolbar leaves the inspector standing, since that is using the app', async () => {
  const screen = await renderGateway();

  pressOn(screen.getByRole('toolbar', { name: 'Codex' }).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('a press on the status bar leaves the inspector standing too', async () => {
  const screen = await renderGateway();

  pressOn(screen.getByText(/p95/).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('pressing a real toolbar control runs it and leaves the inspector standing', async () => {
  const screen = await renderGateway();

  await userEvent.click(screen.getByRole('button', { name: 'Sidebar' }));

  expect(sidebarHidden()).toBe(true);
  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('the toolbar control that opens the inspector closes it once, never twice', async () => {
  const screen = await renderGateway();

  await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));

  await expect.element(screen.getByText('Endpoint', theEndpoint)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('a press inside the inspector leaves it standing, since that is not looking away', async () => {
  const screen = await renderGateway();

  pressOn(screen.getByText('Base URL', theEndpoint).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('taking hold of the border that sizes the inspector never puts it away', async () => {
  const screen = await renderGateway();

  pressOn(screen.getByRole('separator', { name: 'Inspector width' }).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('a press on the node that opens the inspector closes it once, never twice', async () => {
  const screen = await renderGateway();

  await userEvent.click(screen.getByRole('button', { name: /Codex/ }));

  await expect.element(screen.getByText('Endpoint', theEndpoint)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Codex/ }));

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('choosing another gateway leaves the inspector standing, being a choice not a look away', async () => {
  const claude = gatewaySeed({ slug: 'claude', displayName: 'Claude', port: 51235 });
  const screen = await renderAt('/gateways/codex', { gateways: [codex, claude] });

  await userEvent.click(screen.getByRole('link', { name: /Claude/ }));

  await expect.element(screen.getByRole('heading', { name: 'Claude' })).toBeVisible();
  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();
});

test('a draft in flight survives a press on the stage and comes back as it was', async () => {
  const screen = await renderGateway();

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');

  pressOn(theStageBackground(screen.container));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fast Sonnet');
});
