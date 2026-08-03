import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { Badge } from './badge';

test('the badge prints the plan it carries', async () => {
  await render(<Badge>Max</Badge>);

  await expect.element(page.getByText('Max')).toBeVisible();
});

test('a badge riding beside a name leaves that name whole', async () => {
  await render(
    <h2>
      Anthropic <Badge>Max</Badge>
    </h2>,
  );

  await expect.element(page.getByRole('heading', { name: 'Anthropic Max' })).toBeVisible();
});

test('the badge offers nothing to press, so it stays part of the name it rides with', async () => {
  const screen = await render(<Badge>Max</Badge>);

  await expect.element(page.getByText('Max')).toBeVisible();
  expect(screen.container.querySelectorAll('button, a, [role]')).toHaveLength(0);
});
