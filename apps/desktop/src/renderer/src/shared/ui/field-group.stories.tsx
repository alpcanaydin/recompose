import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { FieldGroup, FieldRow, Switch } from './index';

const meta = preview.meta({
  component: FieldGroup,
  args: { heading: 'General', children: null },
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
});
