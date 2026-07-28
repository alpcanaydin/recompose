import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { SegmentedControl } from './index';

type Theme = 'system' | 'light' | 'dark';

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: Theme; label: string }[];

const meta = preview.meta({
  component: SegmentedControl,
  args: {
    label: 'Appearance',
    value: 'system',
    options: themeOptions,
    onChangeValue: () => {},
  },
});

function ControlledThemeChoice({ inert = false }: { inert?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system');

  return (
    <>
      <SegmentedControl
        label="Appearance"
        value={theme}
        options={themeOptions}
        onChangeValue={setTheme}
        inert={inert}
      />
      <p>stored: {theme}</p>
    </>
  );
}

/** One of three mutually exclusive choices, resting on the app default. */
export const Basic = meta.story({
  render: () => <ControlledThemeChoice />,
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Appearance' });
    const system = canvas.getByRole('radio', { name: 'System' });
    const light = canvas.getByRole('radio', { name: 'Light' });

    await expect(group).toBeInTheDocument();
    await expect(system).toHaveAttribute('aria-checked', 'true');
    await expect(light).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(light);

    await expect(light).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('stored: light')).toBeInTheDocument();
  },
});

/** The keyboard contract: one tab stop, and an arrow key that moves and selects at once. */
export const ArrowKeysSelect = meta.story({
  render: () => <ControlledThemeChoice />,
  play: async ({ canvas, userEvent }) => {
    const system = canvas.getByRole('radio', { name: 'System' });
    const light = canvas.getByRole('radio', { name: 'Light' });

    await expect(system).toHaveAttribute('tabindex', '0');
    await expect(light).toHaveAttribute('tabindex', '-1');

    system.focus();
    await userEvent.keyboard('{ArrowRight}');

    await expect(light).toHaveFocus();
    await expect(light).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('stored: light')).toBeInTheDocument();
  },
});

/** A choice whose machinery the app lacks: reachable and explained, never movable. */
export const Inert = meta.story({
  render: () => <ControlledThemeChoice inert />,
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Appearance' });
    const light = canvas.getByRole('radio', { name: 'Light' });

    await expect(group).toHaveAttribute('aria-disabled', 'true');
    await expect(light).not.toHaveAttribute('disabled');

    await userEvent.click(light);

    await expect(canvas.getByText('stored: system')).toBeInTheDocument();
  },
});

/** The same control under the dark scheme, where the selected segment lifts off the track. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  render: () => <ControlledThemeChoice />,
});
