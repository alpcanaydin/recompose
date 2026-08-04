import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { AccountKind } from '../../../../entities/account';
import type { CatalogEntry } from '../../model/provider-catalog';

import { CatalogList } from './catalog-list';

function picksMadeOn(kind: AccountKind) {
  const picked: CatalogEntry[] = [];

  return {
    picked,
    screen: render(
      <CatalogList
        kind={kind}
        onPick={(entry) => {
          picked.push(entry);
        }}
      />,
    ),
  };
}

test('every destination leads with the providers it connects today', async () => {
  const { screen } = picksMadeOn('local');

  await expect.element((await screen).getByRole('button', { name: /^Ollama/ })).toBeVisible();
});

test('the runtime this machine can serve answers a pick like any other card', async () => {
  const { picked, screen } = picksMadeOn('local');

  await (await screen).getByRole('button', { name: /^Ollama/ }).click();

  expect(picked.map((entry) => entry.id)).toEqual(['ollama']);
});

test('a hosted catalog nothing connects yet stands beside the one that does', async () => {
  const { screen } = picksMadeOn('aggregator');

  const resolved = await screen;

  await expect.element(resolved.getByRole('button', { name: /^OpenRouter/ })).toBeVisible();
  await expect
    .element(resolved.getByRole('button', { name: /Together AI/ }))
    .toHaveAttribute('aria-disabled', 'true');
});

test('a card standing under a Soon badge answers neither a pointer nor the keyboard', async () => {
  const { picked, screen } = picksMadeOn('aggregator');

  const soon = (await screen).getByRole('button', { name: /Cerebras/ }).element();

  if (!(soon instanceof HTMLElement)) {
    throw new Error('the Soon card is not an element that can be pressed');
  }

  soon.click();
  soon.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard(' ');

  expect(picked).toEqual([]);
});

test('a Soon card stays at full strength, so its badge reads as loudly as any other', async () => {
  const { screen } = picksMadeOn('local');

  const soon = (await screen).getByRole('button', { name: /Custom local server/ }).element();

  expect(getComputedStyle(soon).opacity).toBe('1');

  for (const part of soon.querySelectorAll('*')) {
    expect(getComputedStyle(part).opacity).toBe('1');
  }
});

test('a Soon vendor draws its own mark rather than a shared glyph', async () => {
  const { screen } = picksMadeOn('local');

  const withAMark = (await screen).getByRole('button', { name: /LM Studio/ }).element();
  const category = (await screen).getByRole('button', { name: /Custom local server/ }).element();

  expect(withAMark.querySelector('svg')?.innerHTML).not.toBe(
    category.querySelector('svg')?.innerHTML,
  );
});

test('a card is announced as the words it prints, never as the vendor behind its mark', async () => {
  const { screen } = picksMadeOn('subscription');

  await expect
    .element((await screen).getByRole('button', { name: /^Claude/ }))
    .toHaveAccessibleName('ClaudeSign in with your Pro or Max plan');
});
