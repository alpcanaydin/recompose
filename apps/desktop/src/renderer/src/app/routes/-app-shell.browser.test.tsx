import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

test('the shell shows the sidebar and the invitation at the root', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('link', { name: 'Gateways' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
});

test('the sidebar reaches the creation sheet once the empty state has left', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway' }))
    .not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'New Gateway…' }).click();

  await expect.element(screen.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
});

test('a gateway saved from the sheet reaches the sidebar as a running row', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('button', { name: 'Create Gateway' }).click();
  await screen.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await screen.getByRole('textbox', { name: 'Slug' }).fill('codex');

  screen.getByRole('button', { name: 'Create Gateway' }).last().element().focus();

  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByRole('link', { name: 'Codex Running' })).toBeVisible();
});

test('a selected gateway puts its address and its control in the toolbar', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Copy address' })).toBeVisible();
});

test('a surface with no gateway selected leaves the toolbar empty chrome', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByRole('link', { name: 'Codex Stopped' })).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Copy address' }))
    .not.toBeInTheDocument();
});

test('a gateway surface reads what its traffic is carrying', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText(/req\/min/u)).toBeVisible();
  await expect.element(screen.getByText(/nodes/u)).toBeVisible();
});

test('a surface holding no gateway carries no traffic reading', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByText(/req\/min/u)).not.toBeInTheDocument();
});

test('the System group reaches the usage screen', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('group', { name: 'System' }).getByRole('link', { name: 'Usage' }).click();

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Usage' })).toBeVisible();
});

test('the sidebar carries a System group holding Settings', async () => {
  const screen = await renderAt('/');

  const system = screen.getByRole('group', { name: 'System' });

  await expect.element(system).toBeVisible();
  await expect.element(system.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('arriving at settings through the sidebar leaves focus where the person put it', async () => {
  const screen = await renderAt('/');

  const settings = screen.getByRole('link', { name: 'Settings' });

  await settings.click();

  await expect.element(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).not.toHaveFocus();
  await expect.element(settings).toHaveFocus();
});
