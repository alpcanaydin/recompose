import type { Account } from '@recompose/contracts';

import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { ServedModel } from '../../model/served-models';

import { ServedModelRow } from './served-model-row';

const workKey: Account = {
  id: 'k1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'work',
  credentialRef: 'c1',
};

const serving: ServedModel = {
  id: 'fast',
  displayName: 'Fast',
  providerModel: 'claude-haiku-4-5',
  target: { standing: 'serving', account: workKey },
};

async function renderRow(served: ServedModel) {
  return render(
    <ul>
      <ServedModelRow served={served} />
    </ul>,
  );
}

test('a serving row reads its name over the binding a request under it reaches', async () => {
  const screen = await renderRow(serving);

  await expect.element(screen.getByText('Fast', { exact: true })).toBeVisible();
  await expect
    .element(screen.getByText('fast → work · claude-haiku-4-5', { exact: true }))
    .toBeVisible();
  await expect.element(screen.getByText('serving', { exact: true })).toBeVisible();
});

test('a row whose target account left the registry says so instead of serving', async () => {
  const screen = await renderRow({ ...serving, target: { standing: 'removed' } });

  await expect.element(screen.getByText('target removed', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('fast → claude-haiku-4-5', { exact: true })).toBeVisible();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('the row hands the id a client asks for to the clipboard', async () => {
  const written = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  const screen = await renderRow(serving);

  await userEvent.click(screen.getByRole('button', { name: 'Copy model id' }));

  await expect.element(screen.getByRole('status')).toHaveTextContent('Model id copied.');
  expect(written).toHaveBeenCalledWith('fast');
});
