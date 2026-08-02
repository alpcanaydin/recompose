import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

/** The sidebar controls a person can actually press, which excludes any the shell put out of reach. */
function reachableSidebarControls(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[aria-label="Sidebar"]')].filter(
    (control) => control.closest('[inert]') === null,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('the shell shows the sidebar and the invitation at the root', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('group', { name: 'System' })).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
});

test('the sidebar gathers the account kinds under their own group', async () => {
  const screen = await renderAt('/');

  const providers = screen.getByRole('group', { name: 'Providers' });

  await expect.element(providers.getByRole('link', { name: 'Subscriptions' })).toBeVisible();
  await expect.element(providers.getByRole('link', { name: 'API Keys' })).toBeVisible();
  await expect.element(providers.getByRole('link', { name: 'Aggregators' })).toBeVisible();
});

test('a kind row points at the providers surface narrowed to that kind', async () => {
  const screen = await renderAt('/');

  await expect
    .poll(() => screen.getByRole('link', { name: 'API Keys' }).element().getAttribute('href'))
    .toMatch(/\/providers\?kind=api-key$/);
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

  screen.getByRole('button', { name: 'Create Gateway' }).last().element().focus();

  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByRole('link', { name: 'Codex Running' })).toBeVisible();
});

test('a selected gateway puts its address and its control in the toolbar', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
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

test('the standing sidebar carries the control that puts it away', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('button', { name: 'Sidebar' })).toBeVisible();
  expect(screen.container.querySelector('aside [aria-label="Sidebar"]')).not.toBeNull();
});

test('a surface holding no gateway draws no strip of its own while the sidebar stands', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await expect.element(screen.getByRole('group', { name: 'System' })).toBeVisible();
  expect(screen.container.querySelector('main [aria-label="Sidebar"]')).toBeNull();
});

test('the way back stays in reach once the sidebar has gone', async () => {
  const screen = await renderAt('/', { gateways: [codex] });

  await screen.getByRole('button', { name: 'Sidebar' }).click();

  const settings = screen.getByRole('link', { name: 'Settings' }).element();

  settings.focus();

  expect(document.activeElement).not.toBe(settings);
  expect(reachableSidebarControls(screen.container)).toHaveLength(1);
});

test('one control puts the sidebar away, wherever the person stands', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await expect.element(screen.getByText('localhost:51234')).toBeVisible();
  expect(reachableSidebarControls(screen.container)).toHaveLength(1);
});

test('a gateway surface keeps the way back once the sidebar has gone', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex] });

  await screen.getByRole('button', { name: 'Sidebar' }).click();

  const settings = screen.getByRole('link', { name: 'Settings' }).element();

  settings.focus();

  expect(document.activeElement).not.toBe(settings);
  expect(reachableSidebarControls(screen.container)).toHaveLength(1);
});

test('the edge answers the arrow keys, so a pointer is not the only way', async () => {
  const screen = await renderAt('/', { gateways: [codex] });
  const edge = screen.container.querySelector<HTMLElement>('[aria-label="Sidebar edge"]');

  edge?.focus();
  await userEvent.keyboard('{ArrowLeft}');

  const settings = screen.getByRole('link', { name: 'Settings' }).element();

  settings.focus();
  expect(document.activeElement).not.toBe(settings);

  await userEvent.keyboard('{ArrowRight}');

  const back = screen.getByRole('link', { name: 'Settings' }).element();

  back.focus();
  expect(document.activeElement).toBe(back);
});
