import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { BrandMark } from './brand-mark';

test('the mark beside a provider name adds nothing that name already says', async () => {
  await render(
    <h2>
      <BrandMark name="anthropic" />
      Anthropic
    </h2>,
  );

  await expect.element(page.getByRole('heading', { name: 'Anthropic' })).toBeVisible();
});

test('every provider in the set draws its own mark', async () => {
  const screen = await render(
    <>
      <BrandMark name="anthropic" />
      <BrandMark name="openai" />
    </>,
  );

  const [claude, codex] = screen.container.querySelectorAll('svg');

  expect(claude?.innerHTML).not.toBe(codex?.innerHTML);
});

test('the marks share one drawing box, so a column of providers lines up', async () => {
  const screen = await render(
    <>
      <BrandMark name="anthropic" />
      <BrandMark name="openrouter" />
    </>,
  );

  const boxes = [...screen.container.querySelectorAll('svg')].map((mark) =>
    mark.getAttribute('viewBox'),
  );

  expect(boxes).toEqual(['0 0 24 24', '0 0 24 24']);
});
