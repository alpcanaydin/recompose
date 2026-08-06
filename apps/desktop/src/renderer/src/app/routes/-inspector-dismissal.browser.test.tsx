import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { inspectorOpen, toggleInspector } from '../../shared/lib';
import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

function pressOn(target: Element) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
}

async function renderGateway() {
  return renderAt('/gateways/codex', { gateways: [codex] });
}

const theEndpoint = { exact: true } as const;

beforeEach(() => {
  if (!inspectorOpen()) {
    toggleInspector();
  }
});

test('a press on the toolbar puts the inspector away, because a person looked elsewhere', async () => {
  const screen = await renderGateway();

  await expect.element(screen.getByText('Endpoint', theEndpoint)).toBeVisible();

  pressOn(screen.getByRole('toolbar', { name: 'Codex' }).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).not.toBeInTheDocument();
});

test('a press on the status bar puts the inspector away too, wherever a person reached', async () => {
  const screen = await renderGateway();

  pressOn(screen.getByText(/p95/).element());

  await expect.element(screen.getByText('Endpoint', theEndpoint)).not.toBeInTheDocument();
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

test('a draft in flight survives a press away and comes back as it was', async () => {
  const screen = await renderGateway();

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');

  pressOn(screen.getByText(/p95/).element());

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Inspector' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fast Sonnet');
});
