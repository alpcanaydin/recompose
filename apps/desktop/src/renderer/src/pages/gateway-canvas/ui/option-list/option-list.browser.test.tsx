import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { OptionGroup } from './option-list';

import { OptionList } from './option-list';

const modelOptions = ['a-one', 'a-two', 'a-three', 'a-four', 'b-one', 'b-two', 'b-three'].map(
  (id) => ({ id, name: id }),
);

const manyModels: readonly OptionGroup[] = [{ options: modelOptions }];

const fewAccounts: readonly OptionGroup[] = [
  {
    heading: 'API Keys',
    options: [
      { id: 'k1', name: 'work' },
      { id: 'k2', name: 'personal' },
    ],
  },
];

async function renderList(groups: readonly OptionGroup[]) {
  return render(
    <OptionList
      groups={groups}
      nothingMatched="No model matches that."
      onPick={() => {}}
      picked={undefined}
      searchLabel="Search models"
    />,
  );
}

test('typing in the search narrows the list to what a person typed', async () => {
  const screen = await renderList(manyModels);

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search models' }), 'b-t');

  await expect.element(screen.getByRole('button', { name: 'b-two' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'b-three' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'a-one' })).not.toBeInTheDocument();
});

test('the search holds what a person typed, rather than dropping every keystroke', async () => {
  const screen = await renderList(manyModels);

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search models' }), 'gpt');

  await expect.element(screen.getByRole('searchbox', { name: 'Search models' })).toHaveValue('gpt');
});

test('a search matching nothing says so rather than emptying itself in silence', async () => {
  const screen = await renderList(manyModels);

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search models' }), 'zzz');

  await expect.element(screen.getByText('No model matches that.')).toBeVisible();
});

test('the search reaches the detail beside a name, not the name alone', async () => {
  const runtimes: readonly OptionGroup[] = [
    {
      options: [{ id: 'l1', name: 'Ollama', detail: '127.0.0.1:11434' }, ...modelOptions],
    },
  ];

  const screen = await renderList(runtimes);

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search models' }), '11434');

  await expect.element(screen.getByRole('button', { name: /Ollama/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'a-one' })).not.toBeInTheDocument();
});

test('a list short enough to read whole carries no search at all', async () => {
  const screen = await renderList(fewAccounts);

  await expect.element(screen.getByRole('button', { name: /work/ })).toBeVisible();
  await expect.element(screen.getByRole('searchbox')).not.toBeInTheDocument();
});
