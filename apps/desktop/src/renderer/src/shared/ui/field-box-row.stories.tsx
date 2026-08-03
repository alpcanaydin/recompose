import { expect } from 'storybook/test';

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

/** The same row in the dark scheme, where the field keeps its inset edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
