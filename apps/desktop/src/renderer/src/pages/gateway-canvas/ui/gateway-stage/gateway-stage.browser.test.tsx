import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { freshGateway, servingGateway } from '../../testing/gateway-canvas.testkit';
import { GatewayStage } from './gateway-stage';

async function renderStage(selected: boolean, onToggleSelected: () => void = () => {}) {
  return render(
    <GatewayStage
      gateway={servingGateway}
      onToggleSelected={onToggleSelected}
      selected={selected}
    />,
  );
}

const theNode = /My Gateway/;

test('the gateway node is a control naming the gateway it stands for', async () => {
  const screen = await renderStage(true);

  await expect.element(screen.getByRole('button', { name: theNode })).toBeVisible();
});

test('a selected node says so, so the drawer beside it is never a mystery', async () => {
  const screen = await renderStage(true);

  await expect
    .element(screen.getByRole('button', { name: theNode }))
    .toHaveAttribute('aria-pressed', 'true');
});

test('a node nobody selected says that too', async () => {
  const screen = await renderStage(false);

  await expect
    .element(screen.getByRole('button', { name: theNode }))
    .toHaveAttribute('aria-pressed', 'false');
});

test('pressing the node asks for the selection to turn over', async () => {
  const asked: string[] = [];

  const screen = await renderStage(true, () => {
    asked.push('toggled');
  });

  await userEvent.click(screen.getByRole('button', { name: theNode }));

  expect(asked).toEqual(['toggled']);
});

test('the node counts what the gateway serves, and says so when it serves nothing', async () => {
  const screen = await render(
    <GatewayStage gateway={freshGateway} onToggleSelected={() => {}} selected />,
  );

  await expect.element(screen.getByText(':8397 · no virtual models yet')).toBeVisible();
});
