import { expect } from 'storybook/test';

import { inChecklistPanel } from '#.storybook/checklist-panel';
import preview from '#.storybook/preview';

import type { GetStartedStep } from '../lib/get-started-steps';

import { ChecklistSteps } from './checklist-steps';

const steps: readonly GetStartedStep[] = [
  { title: 'Create a gateway', state: 'done' },
  { title: 'Connect a provider', state: 'current' },
  { title: 'Compose a virtual model', state: 'pending', reason: 'Waits on the canvas.' },
];

const meta = preview.meta({
  component: ChecklistSteps,
  args: { steps },
  decorators: [inChecklistPanel],
});

/**
 * The step rows of the checklist, closed by the way out of the coaching altogether.
 *
 * @summary The reading asks for the current step's mark and for the skip act, because coaching
 * that cannot be left reads as a gate rather than a guide.
 */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Connect a provider')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(await canvas.findByText('Waits on the canvas.')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Skip setup' })).toBeVisible();
  },
});

/** The same steps in the dark scheme, where the done ring keeps its fill. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
