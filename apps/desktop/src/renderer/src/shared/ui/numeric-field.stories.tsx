import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { NumericField } from './index';

const meta = preview.meta({
  component: NumericField,
  args: {
    label: 'Port',
    value: 8397,
    min: 1024,
    max: 65535,
    description: 'Accepts 1024 to 65535.',
    onCommitValue: () => {},
  },
});

type PortDriver = {
  canvas: { getByRole: (role: string, options: { name: string }) => HTMLElement };
  userEvent: {
    clear: (element: Element) => Promise<void>;
    type: (element: Element, text: string) => Promise<void>;
  };
};

function portControl(driver: PortDriver): HTMLElement {
  return driver.canvas.getByRole('textbox', { name: 'Port' });
}

async function typeIntoPort(driver: PortDriver, text: string): Promise<HTMLElement> {
  const control = portControl(driver);

  await driver.userEvent.clear(control);
  await driver.userEvent.type(control, text);

  return control;
}

function ControlledNumericField(args: ComponentProps<typeof NumericField>) {
  const [stored, setStored] = useState(args.value);

  return (
    <>
      <NumericField {...args} value={stored} onCommitValue={setStored} />
      <p>stored: {stored}</p>
    </>
  );
}

/**
 * The resting state, carrying the accepted range in its description.
 *
 * @summary Base UI's number field exposes no spinbutton role, so this control stays a text input.
 */
export const Basic = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    const control = portControl(driver);

    await expect(driver.canvas.queryAllByRole('spinbutton')).toHaveLength(0);
    await expect(control).toHaveValue('8397');
    await expect(control).toHaveAttribute('inputmode', 'numeric');
    await expect(control).toHaveAccessibleDescription('Accepts 1024 to 65535.');
  },
});

/** Leaving the field is one of the two ways a draft becomes the stored value. */
export const CommitsOnBlur = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    await typeIntoPort(driver, '9000');
    await driver.userEvent.tab();

    await expect(driver.canvas.getByText('stored: 9000')).toBeInTheDocument();
  },
});

/** Pressing Enter is the other, so a person never has to guess that leaving saves. */
export const CommitsOnEnter = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    await typeIntoPort(driver, '9000{Enter}');

    await expect(driver.canvas.getByText('stored: 9000')).toBeInTheDocument();
  },
});

/** Escape abandons the draft, so a half-typed number never reaches the document. */
export const RevertsOnEscape = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    await expect(await typeIntoPort(driver, '9000{Escape}')).toHaveValue('8397');
    await expect(driver.canvas.getByText('stored: 8397')).toBeInTheDocument();
  },
});

/** A number outside the range keeps the stored value, and the range stays on screen. */
export const RefusesOutOfRange = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    await expect(await typeIntoPort(driver, '80{Enter}')).toHaveValue('8397');
    await expect(driver.canvas.getByText('stored: 8397')).toBeInTheDocument();
  },
});

/** Anything that is not a whole number keeps the stored value too. */
export const RefusesNonInteger = meta.story({
  render: ControlledNumericField,
  play: async (driver) => {
    await expect(await typeIntoPort(driver, '90.5{Enter}')).toHaveValue('8397');
    await expect(driver.canvas.getByText('stored: 8397')).toBeInTheDocument();
  },
});

/** The same control under the dark scheme. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: ControlledNumericField,
});
