import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { FieldBoxRow } from './field-box-row';

const meta = preview.meta({
  component: FieldBoxRow,
  args: {
    label: 'Name',
    value: 'Codex',
    controlClasses: 'w-sheet-field',
    onChangeValue: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-sheet p-4">
        <Story />
      </div>
    ),
  ],
});

function ControlledFieldBoxRow(args: ComponentProps<typeof FieldBoxRow>) {
  const [typed, setTyped] = useState(args.value);
  const [settled, setSettled] = useState('');

  return (
    <>
      <FieldBoxRow {...args} onChangeValue={setTyped} onCommitValue={setSettled} value={typed} />
      <p>settled: {settled}</p>
    </>
  );
}

async function typeInto(control: HTMLElement, text: string): Promise<void> {
  await userEvent.clear(control);
  await userEvent.type(control, text);
}

/**
 * One labelled row of a field box.
 *
 * @summary The reading asks for the control under its label's name, because the label is the only
 * thing that tells sibling fields apart.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox', { name: 'Name' })).toHaveValue('Codex');
  },
});

/**
 * A row whose last save was refused, carrying the sentence under the field it refuses.
 *
 * @summary The refusal stands where the correction happens, so a person never hunts for which
 * field a sheet-level sentence meant.
 */
export const Refused = meta.story({
  args: { refusal: 'A gateway needs a name.', value: '' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent('A gateway needs a name.');
  },
});

/**
 * A secret row, masked and hinted in the shape its value is handed out in.
 *
 * @summary The hint carries the vendor's documented prefix, so a person pasting recognizes which
 * key belongs here before the mask swallows it.
 */
export const SecretWithHint = meta.story({
  args: { label: 'Key', placeholder: 'sk-ant-…', type: 'password', value: '' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText('Key')).toHaveAttribute('placeholder', 'sk-ant-…');
  },
});

/**
 * Pressing Enter settles what was typed, without leaving the field.
 *
 * @summary Enter is the act a person reaches for when the typed value is the whole answer, so the
 * row takes it as the settle rather than asking for a button beside the field.
 */
export const CommitsOnEnter = meta.story({
  render: ControlledFieldBoxRow,
  play: async ({ canvas }) => {
    await typeInto(await canvas.findByRole('textbox', { name: 'Name' }), 'Codex CLI{Enter}');

    await expect(await canvas.findByText('settled: Codex CLI')).toBeInTheDocument();
  },
});

/**
 * Leaving the field settles what was typed, so a draft never goes quietly missing.
 *
 * @summary Moving on is the other way a person says they are done, and a value settles once per
 * value, so Enter followed by a blur never settles the same thing twice.
 */
export const CommitsOnBlur = meta.story({
  render: ControlledFieldBoxRow,
  play: async ({ canvas }) => {
    await typeInto(await canvas.findByRole('textbox', { name: 'Name' }), 'Codex CLI');
    await userEvent.tab();

    await expect(await canvas.findByText('settled: Codex CLI')).toBeInTheDocument();
  },
});

/** The same row in the dark scheme, where the field keeps its inset edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
