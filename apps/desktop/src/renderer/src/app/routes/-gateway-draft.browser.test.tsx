import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { inspectorOpen, showSidebar, toggleInspector } from '../../shared/lib';
import { gatewaySeed } from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });
const claude = gatewaySeed({ slug: 'claude', displayName: 'Claude', port: 51235 });

beforeEach(() => {
  localStorage.clear();
  showSidebar();

  if (!inspectorOpen()) {
    toggleInspector();
  }
});

test('a draft on one gateway never follows a person to another', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex, claude] });

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');

  await userEvent.click(screen.getByRole('link', { name: /Claude/ }));

  await expect.element(screen.getByRole('heading', { name: 'Claude' })).toBeVisible();
  await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
});

test('a draft is still standing when a person comes back to the gateway they left it on', async () => {
  const screen = await renderAt('/gateways/codex', { gateways: [codex, claude] });

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');

  await userEvent.click(screen.getByRole('link', { name: /Claude/ }));
  await expect.element(screen.getByRole('heading', { name: 'Claude' })).toBeVisible();

  await userEvent.click(screen.getByRole('link', { name: /Codex/ }));

  await expect.element(screen.getByRole('heading', { name: 'Codex' })).toBeVisible();
  await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
});
