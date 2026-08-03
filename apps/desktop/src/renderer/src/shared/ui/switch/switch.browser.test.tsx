import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Switch } from './switch';

const label = 'Reduce wire motion';

function StatefulSwitch({ inert }: { inert: boolean }) {
  const [checked, setChecked] = useState(false);

  return <Switch checked={checked} inert={inert} label={label} onChangeChecked={setChecked} />;
}

test('a switch a person may move follows the space bar', async () => {
  const screen = await render(<StatefulSwitch inert={false} />);
  const control = screen.getByRole('switch', { name: label });

  await userEvent.tab();
  await userEvent.keyboard(' ');

  await expect.element(control).toBeChecked();
});

test('a switch waiting on missing machinery refuses the space bar', async () => {
  const screen = await render(<StatefulSwitch inert />);
  const control = screen.getByRole('switch', { name: label });

  await userEvent.tab();
  await userEvent.keyboard(' ');

  await expect.element(control).not.toBeChecked();
  await expect.element(control).toHaveAttribute('aria-disabled', 'true');
});
