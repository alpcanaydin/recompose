import { useRef, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { Sheet } from './sheet';

function GatewaySheet() {
  const nameField = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);

  return (
    <Sheet
      description="Name it and pick the port it serves on."
      footer={<button type="button">Create Gateway</button>}
      initialFocus={nameField}
      onOpenChange={setOpen}
      open={open}
      title="Create a gateway"
    >
      <input aria-label="Name" ref={nameField} />
    </Sheet>
  );
}

test('the sheet opens with focus on the control the caller names', async () => {
  await render(<GatewaySheet />);

  await expect.element(page.getByRole('textbox', { name: 'Name' })).toHaveFocus();
});

test('dismissing the sheet takes it off the screen', async () => {
  await render(<GatewaySheet />);

  await expect.element(page.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect
    .element(page.getByRole('dialog', { name: 'Create a gateway' }))
    .not.toBeInTheDocument();
});
