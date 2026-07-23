import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './app';

test('the shell presents a sidebar beside the main area', async () => {
  const screen = await render(<App />);

  await expect.element(screen.getByText('Sidebar')).toBeVisible();
  await expect.element(screen.getByText('Main Area')).toBeVisible();
});
