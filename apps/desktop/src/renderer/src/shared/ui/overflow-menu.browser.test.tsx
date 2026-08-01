import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { OverflowMenu } from './overflow-menu';

function rowActions(onSelect = vi.fn()) {
  return [
    { label: 'Use this account', onSelect },
    { label: 'Sign in again', onSelect },
    { label: 'Remove', onSelect },
  ];
}

test('the menu keeps its actions away until a person asks for them', async () => {
  await render(<OverflowMenu items={rowActions()} label="Actions for Anthropic" />);

  await expect.element(page.getByRole('button', { name: 'Actions for Anthropic' })).toBeVisible();

  expect(page.getByRole('menuitem', { name: 'Remove' }).elements()).toHaveLength(0);
});

test('opening the menu lays out its actions in reading order', async () => {
  await render(<OverflowMenu items={rowActions()} label="Actions for Anthropic" />);

  await page.getByRole('button', { name: 'Actions for Anthropic' }).click();

  const actions = page.getByRole('menuitem').elements();

  expect(actions.map((action) => action.textContent)).toEqual([
    'Use this account',
    'Sign in again',
    'Remove',
  ]);
});

test('choosing an action runs it and takes the menu away', async () => {
  const onSelect = vi.fn();

  await render(<OverflowMenu items={rowActions(onSelect)} label="Actions for Anthropic" />);

  await page.getByRole('button', { name: 'Actions for Anthropic' }).click();
  await page.getByRole('menuitem', { name: 'Sign in again' }).click();

  expect(onSelect).toHaveBeenCalledTimes(1);

  await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('dismissing the menu runs nothing and hands focus back to the control', async () => {
  const onSelect = vi.fn();

  await render(<OverflowMenu items={rowActions(onSelect)} label="Actions for Anthropic" />);

  const trigger = page.getByRole('button', { name: 'Actions for Anthropic' });

  await trigger.click();
  await expect.element(page.getByRole('menu')).toBeVisible();

  await userEvent.keyboard('{Escape}');

  expect(onSelect).not.toHaveBeenCalled();
  await expect.element(trigger).toHaveFocus();
});

test('the keyboard alone opens the menu and reaches its actions', async () => {
  await render(<OverflowMenu items={rowActions()} label="Actions for Anthropic" />);

  await userEvent.tab();
  await expect.element(page.getByRole('button', { name: 'Actions for Anthropic' })).toHaveFocus();

  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByRole('menuitem', { name: 'Use this account' })).toHaveFocus();

  await userEvent.keyboard('{ArrowDown}');

  await expect.element(page.getByRole('menuitem', { name: 'Sign in again' })).toHaveFocus();
});
