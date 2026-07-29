import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import { FieldGroup, FieldRow, NumericField, SegmentedControl, Switch, TextField } from './index';

const retentionOptions = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const meta = preview.meta({
  component: FieldGroup,
  args: { heading: 'General', children: null },
  decorators: [inSettingsColumn],
});

function GeneralRows() {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);

  return (
    <>
      <FieldRow
        control={
          <Switch
            checked={launchAtLogin}
            label="Launch at login"
            onChangeChecked={setLaunchAtLogin}
          />
        }
        description="Starts recompose when you sign in."
        label="Launch at login"
      />
      <FieldRow
        control={
          <Switch checked={false} inert label="Gateway autostart" onChangeChecked={() => {}} />
        }
        inert
        label="Gateway autostart"
        reason="Waiting on the engine."
      />
    </>
  );
}

/** A section of related settings under one overline heading. */
export const Basic = meta.story({
  args: { children: <GeneralRows /> },
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'General' });

    await expect(group).toContainElement(canvas.getByRole('switch', { name: 'Launch at login' }));
    await expect(group).toContainElement(canvas.getByRole('switch', { name: 'Gateway autostart' }));
  },
});

/** The same section under the dark scheme, where the card lifts off the content surface. */
export const DarkScheme = meta.story({
  args: { children: <GeneralRows /> },
  globals: { theme: 'dark' },
  play: async () => {
    await expect(getComputedStyle(document.body).colorScheme).toBe('dark');
  },
});

function ServerRows() {
  const [port, setPort] = useState(8397);

  return (
    <>
      <FieldRow
        control={
          <NumericField label="Port" max={65535} min={1024} onCommitValue={setPort} value={port} />
        }
        description="Accepts 1024 to 65535."
        label="Port"
      />
      <FieldRow
        control={
          <TextField inert label="Bind address" onChangeValue={() => {}} value="127.0.0.1" />
        }
        inert
        label="Bind address"
        reason="Waiting on the engine."
      />
      <FieldRow
        control={
          <SegmentedControl
            inert
            label="Log retention"
            onChangeValue={() => {}}
            options={retentionOptions}
            value="30"
          />
        }
        inert
        label="Log retention"
        reason="Waiting on the engine."
      />
    </>
  );
}

/**
 * Every control the kit ships, stacked the way a settings section stacks them.
 *
 * @summary The merge gate for the inert pattern: waiting rows stay reachable and name their reason.
 */
export const WithEveryControl = meta.story({
  args: { heading: 'Server', children: <ServerRows /> },
  play: async ({ canvas }) => {
    const bindAddress = canvas.getByRole('textbox', { name: 'Bind address' });
    const retention = canvas.getByRole('radiogroup', { name: 'Log retention' });

    await expect(bindAddress).toHaveAccessibleDescription('Waiting on the engine.');
    await expect(bindAddress).toHaveAttribute('aria-disabled', 'true');
    await expect(retention).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('textbox', { name: 'Port' })).toHaveValue('8397');
  },
});
