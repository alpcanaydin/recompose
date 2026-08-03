import { useRef, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { Sheet } from './sheet';

function GatewaySheet() {
  const nameField = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [bodySize, setBodySize] = useState(300);

  return (
    <>
      <button
        onClick={() => {
          setBodySize(140);
          setOpen(true);
        }}
        type="button"
      >
        Reopen
      </button>
      <Sheet
        description="Name it and pick the port it serves on."
        footer={<button type="button">Create Gateway</button>}
        initialFocus={nameField}
        onOpenChange={setOpen}
        open={open}
        title="Create a gateway"
      >
        <input aria-label="Name" ref={nameField} />
        <div style={{ height: bodySize }} />
      </Sheet>
    </>
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

function mountedBody(): Element | undefined {
  return [...document.querySelectorAll('.sheet-body-resize')].at(-1);
}

function bodyMeasurementDrift(): number {
  const wrapper = mountedBody();
  const inner = wrapper?.firstElementChild;

  if (!(wrapper instanceof HTMLElement) || !(inner instanceof HTMLElement)) {
    return Number.POSITIVE_INFINITY;
  }

  if (wrapper.style.height === '') {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(Number.parseFloat(wrapper.style.height) - inner.offsetHeight);
}

test('the body carries the height its content lays out, even under an entering scale', async () => {
  const scaledLikeTheEnterTransition = document.createElement('style');

  scaledLikeTheEnterTransition.textContent = '[role="dialog"] { scale: 0.97; }';
  document.head.append(scaledLikeTheEnterTransition);

  try {
    await render(<GatewaySheet />);

    await expect.element(page.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();

    await expect.poll(bodyMeasurementDrift).toBeLessThan(1);
  } finally {
    scaledLikeTheEnterTransition.remove();
  }
});

async function nextFramePaints(): Promise<void> {
  await new Promise((settle) => {
    requestAnimationFrame(() => {
      settle(undefined);
    });
  });
}

test('a closed sheet forgets its height, so a reopen never starts on a stale clamp', async () => {
  await render(<GatewaySheet />);

  await expect.poll(bodyMeasurementDrift).toBeLessThan(1);

  await userEvent.keyboard('{Escape}');
  await expect
    .element(page.getByRole('dialog', { name: 'Create a gateway' }))
    .not.toBeInTheDocument();

  await page.getByRole('button', { name: 'Reopen' }).click();

  const clampedFrames: number[] = [];

  for (let frame = 0; frame < 10; frame += 1) {
    const drift = bodyMeasurementDrift();

    if (Number.isFinite(drift) && drift > 1) {
      clampedFrames.push(drift);
    }

    await nextFramePaints();
  }

  expect(clampedFrames).toEqual([]);
  await expect.poll(bodyMeasurementDrift).toBeLessThan(1);
});
